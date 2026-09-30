import {
  App,
  ItemView,
  MarkdownRenderer,
  Menu,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  moment,
  normalizePath,
  setIcon
} from "obsidian";

const VIEW_TYPE = "momentlog-view";
const SECTION_HEADING = "## Momentlog";
const LEGACY_SECTION_HEADING = "## Timelog";
const ENTRY_PATTERN = /<!-- (?:momentlog|timelog)-entry:([^\n]+) -->\s*\n### ([^\n]+)\s*\n\n?([\s\S]*?)\n<!-- \/(?:momentlog|timelog)-entry -->/g;

interface MomentlogSettings {
  folder: string;
  fileNameFormat: string;
}

interface MomentlogMoment {
  id: string;
  time: string;
  content: string;
}

interface PendingAttachment {
  file: File;
  url: string;
}

const DEFAULT_SETTINGS: MomentlogSettings = {
  folder: "Momentlog",
  fileNameFormat: "YYYY-MM-DD"
};

export default class MomentlogPlugin extends Plugin {
  settings: MomentlogSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new MomentlogView(leaf, this));

    this.addRibbonIcon("clock-3", "Open Momentlog", () => {
      void this.openMomentlog(false);
    });

    this.addCommand({
      id: "open",
      name: "Open Momentlog",
      callback: () => {
        void this.openMomentlog(false);
      }
    });

    this.addCommand({
      id: "capture-moment",
      name: "Capture a moment",
      callback: () => {
        void this.openMomentlog(true);
      }
    });

    this.addSettingTab(new MomentlogSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async openMomentlog(focusComposer: boolean): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];

    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE,
        active: true
      });
    }

    await this.app.workspace.revealLeaf(leaf);

    if (focusComposer && leaf.view instanceof MomentlogView) {
      leaf.view.focusComposer();
    }
  }

  getDailyFilePath(date: string): string {
    const formatted = moment(date, "YYYY-MM-DD").format(this.settings.fileNameFormat);
    const fileName = formatted.toLowerCase().endsWith(".md") ? formatted : `${formatted}.md`;
    const folder = this.settings.folder.trim().replace(/^\/+|\/+$/g, "");
    return normalizePath(folder ? `${folder}/${fileName}` : fileName);
  }

  async getDailyFile(date: string): Promise<TFile | null> {
    const file = this.app.vault.getAbstractFileByPath(this.getDailyFilePath(date));
    return file instanceof TFile ? file : null;
  }

  async getOrCreateDailyFile(date: string): Promise<TFile> {
    const path = this.getDailyFilePath(date);
    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof TFile) {
      return existing;
    }

    if (existing) {
      throw new Error(`${path} is not a file.`);
    }

    await this.ensureFolder(this.parentPath(path));
    const initial = `# ${moment(date, "YYYY-MM-DD").format("YYYY-MM-DD")}\n\n${SECTION_HEADING}\n\n`;
    return this.app.vault.create(path, initial);
  }

  async readMoments(date: string): Promise<MomentlogMoment[]> {
    const file = await this.getDailyFile(date);

    if (!file) {
      return [];
    }

    const content = await this.app.vault.cachedRead(file);
    const moments: MomentlogMoment[] = [];
    ENTRY_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = ENTRY_PATTERN.exec(content)) !== null) {
      const id = match[1];
      const time = match[2];
      const body = match[3];

      if (id && time && body !== undefined) {
        moments.push({
          id,
          time,
          content: body.trim()
        });
      }
    }

    return moments.sort((a, b) => b.id.localeCompare(a.id));
  }

  async addMoment(date: string, content: string): Promise<void> {
    const file = await this.getOrCreateDailyFile(date);
    const id = new Date().toISOString();
    const time = moment().format("HH:mm");
    const block = this.buildEntryBlock(id, time, content);

    await this.app.vault.process(file, (source) => this.insertEntry(source, block));
  }

  async updateMoment(date: string, momentEntry: MomentlogMoment, content: string): Promise<void> {
    const file = await this.getDailyFile(date);

    if (!file) {
      throw new Error("Daily note not found.");
    }

    const pattern = new RegExp(
      `<!-- (?:momentlog|timelog)-entry:${this.escapeRegex(momentEntry.id)} -->[\\s\\S]*?<!-- \\/(?:momentlog|timelog)-entry -->`
    );
    const replacement = this.buildEntryBlock(momentEntry.id, momentEntry.time, content);

    await this.app.vault.process(file, (source) => {
      if (!pattern.test(source)) {
        throw new Error("Momentlog entry not found.");
      }

      return source.replace(pattern, replacement);
    });
  }

  async deleteMoment(date: string, momentEntry: MomentlogMoment): Promise<void> {
    const file = await this.getDailyFile(date);

    if (!file) {
      return;
    }

    const pattern = new RegExp(
      `\\n?<!-- (?:momentlog|timelog)-entry:${this.escapeRegex(momentEntry.id)} -->[\\s\\S]*?<!-- \\/(?:momentlog|timelog)-entry -->\\n?`
    );

    await this.app.vault.process(file, (source) => source.replace(pattern, "\n"));
  }

  async saveAttachment(date: string, file: File, index: number): Promise<string> {
    const baseFolder = this.settings.folder.trim().replace(/^\/+|\/+$/g, "");
    const attachmentFolder = normalizePath(
      baseFolder ? `${baseFolder}/attachments/${date}` : `attachments/${date}`
    );

    await this.ensureFolder(attachmentFolder);

    const extension = this.fileExtension(file);
    const stem = `${moment().format("HHmmss")}${index === 0 ? "" : `-${index + 1}`}`;
    let path = normalizePath(`${attachmentFolder}/${stem}.${extension}`);
    let suffix = 2;

    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${attachmentFolder}/${stem}-${suffix}.${extension}`);
      suffix += 1;
    }

    await this.app.vault.createBinary(path, await file.arrayBuffer());
    return path;
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<MomentlogSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});

    if (!data?.folder) {
      const momentlogFolder = this.app.vault.getAbstractFileByPath(DEFAULT_SETTINGS.folder);
      const legacyFolder = this.app.vault.getAbstractFileByPath("Timelog");

      if (!momentlogFolder && legacyFolder) {
        this.settings.folder = "Timelog";
        await this.saveData(this.settings);
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private buildEntryBlock(id: string, time: string, content: string): string {
    return `<!-- momentlog-entry:${id} -->\n### ${time}\n\n${content.trim()}\n<!-- /momentlog-entry -->`;
  }

  private insertEntry(source: string, block: string): string {
    const headingPattern = /^(?:## Momentlog|## Timelog)\s*$/m;
    const heading = headingPattern.exec(source);

    if (!heading || heading.index === undefined) {
      const prefix = source.trimEnd();
      return `${prefix}${prefix ? "\n\n" : ""}${SECTION_HEADING}\n\n${block}\n`;
    }

    const insertAt = heading.index + heading[0].length;
    const before = source.slice(0, insertAt);
    const after = source.slice(insertAt).replace(/^\s*\n/, "").trimStart();

    return `${before}\n\n${block}${after ? `\n\n${after}` : "\n"}`;
  }

  private async ensureFolder(path: string): Promise<void> {
    if (!path) {
      return;
    }

    const parts = normalizePath(path).split("/");
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);

      if (!existing) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private parentPath(path: string): string {
    const index = path.lastIndexOf("/");
    return index === -1 ? "" : path.slice(0, index);
  }

  private fileExtension(file: File): string {
    const named = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

    if (named) {
      return named;
    }

    const byMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg"
    };

    return byMime[file.type] ?? "png";
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

class MomentlogView extends ItemView {
  private plugin: MomentlogPlugin;
  private selectedDate = moment().format("YYYY-MM-DD");
  private textareaEl!: HTMLTextAreaElement;
  private recordButtonEl!: HTMLButtonElement;
  private dateEl!: HTMLElement;
  private attachmentsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private pendingAttachments: PendingAttachment[] = [];
  private capturing = false;

  constructor(leaf: WorkspaceLeaf, plugin: MomentlogPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Momentlog";
  }

  getIcon(): string {
    return "clock-3";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("momentlog-view");
    this.buildToolbar();
    this.buildComposer();
    this.contentEl.createEl("h3", { text: "Momentlog", cls: "momentlog-heading" });
    this.listEl = this.contentEl.createDiv({ cls: "momentlog-list" });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path === this.plugin.getDailyFilePath(this.selectedDate)) {
          void this.refreshTimeline();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.path === this.plugin.getDailyFilePath(this.selectedDate)) {
          void this.refreshTimeline();
        }
      })
    );

    this.updateDate();
    await this.refreshTimeline();
  }

  async onClose(): Promise<void> {
    this.clearAttachments();
  }

  focusComposer(): void {
    window.setTimeout(() => this.textareaEl?.focus(), 0);
  }

  private buildToolbar(): void {
    const toolbar = this.contentEl.createDiv({ cls: "momentlog-toolbar" });
    const previous = toolbar.createEl("button", {
      cls: "momentlog-icon-button",
      attr: { "aria-label": "Previous day" }
    });
    setIcon(previous, "chevron-left");
    previous.addEventListener("click", () => {
      void this.changeDate(-1);
    });

    this.dateEl = toolbar.createDiv({ cls: "momentlog-date" });

    const next = toolbar.createEl("button", {
      cls: "momentlog-icon-button",
      attr: { "aria-label": "Next day" }
    });
    setIcon(next, "chevron-right");
    next.addEventListener("click", () => {
      void this.changeDate(1);
    });

    toolbar.createDiv({ cls: "momentlog-spacer" });

    const today = toolbar.createEl("button", {
      text: "Today",
      cls: "momentlog-today-button"
    });
    today.addEventListener("click", () => {
      this.selectedDate = moment().format("YYYY-MM-DD");
      this.updateDate();
      void this.refreshTimeline();
    });
  }

  private buildComposer(): void {
    const composer = this.contentEl.createDiv({ cls: "momentlog-composer" });

    this.textareaEl = composer.createEl("textarea", {
      cls: "momentlog-input",
      attr: {
        placeholder: "What are you doing right now?",
        "aria-label": "New moment"
      }
    });

    this.attachmentsEl = composer.createDiv({ cls: "momentlog-attachments" });

    const footer = composer.createDiv({ cls: "momentlog-composer-footer" });
    const addImage = footer.createEl("button", {
      cls: "momentlog-icon-button",
      attr: { "aria-label": "Add images", title: "Add images" }
    });
    setIcon(addImage, "image-plus");

    const fileInput = footer.createEl("input", {
      attr: {
        type: "file",
        accept: "image/*",
        multiple: "true"
      }
    });
    fileInput.style.display = "none";

    addImage.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      this.addFiles(Array.from(fileInput.files ?? []));
      fileInput.value = "";
    });

    this.recordButtonEl = footer.createEl("button", {
      text: "Record",
      cls: "mod-cta momentlog-record-button"
    });
    this.recordButtonEl.disabled = true;
    this.recordButtonEl.addEventListener("click", () => {
      void this.capture();
    });

    this.registerDomEvent(this.textareaEl, "input", () => this.updateCaptureState());

    this.registerDomEvent(this.textareaEl, "keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void this.capture();
      }
    });

    this.registerDomEvent(this.textareaEl, "paste", (event) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/")
      );

      if (files.length > 0) {
        event.preventDefault();
        this.addFiles(files);
      }
    });

    this.registerDomEvent(composer, "dragover", (event) => {
      event.preventDefault();
      composer.addClass("is-dragging");
    });

    this.registerDomEvent(composer, "dragleave", () => {
      composer.removeClass("is-dragging");
    });

    this.registerDomEvent(composer, "drop", (event) => {
      event.preventDefault();
      composer.removeClass("is-dragging");
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
        file.type.startsWith("image/")
      );
      this.addFiles(files);
    });
  }

  private async changeDate(days: number): Promise<void> {
    this.selectedDate = moment(this.selectedDate, "YYYY-MM-DD")
      .add(days, "day")
      .format("YYYY-MM-DD");
    this.updateDate();
    await this.refreshTimeline();
  }

  private updateDate(): void {
    const date = moment(this.selectedDate, "YYYY-MM-DD");
    const today = moment().format("YYYY-MM-DD");
    this.dateEl.setText(this.selectedDate === today ? "Today" : date.format("MMM D, ddd"));
  }

  private addFiles(files: File[]): void {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        continue;
      }

      this.pendingAttachments.push({
        file,
        url: URL.createObjectURL(file)
      });
    }

    this.renderAttachments();
    this.updateCaptureState();
  }

  private renderAttachments(): void {
    this.attachmentsEl.empty();

    this.pendingAttachments.forEach((attachment, index) => {
      const item = this.attachmentsEl.createDiv({ cls: "momentlog-attachment" });
      item.createEl("img", {
        attr: {
          src: attachment.url,
          alt: attachment.file.name || "Pending image"
        }
      });

      const remove = item.createEl("button", {
        cls: "momentlog-attachment-remove",
        attr: { "aria-label": "Remove image" }
      });
      setIcon(remove, "x");
      remove.addEventListener("click", () => {
        URL.revokeObjectURL(attachment.url);
        this.pendingAttachments.splice(index, 1);
        this.renderAttachments();
        this.updateCaptureState();
      });
    });
  }

  private updateCaptureState(): void {
    const hasContent =
      this.textareaEl.value.trim().length > 0 || this.pendingAttachments.length > 0;
    this.recordButtonEl.disabled = !hasContent || this.capturing;
  }

  private async capture(): Promise<void> {
    const text = this.textareaEl.value.trim();

    if ((!text && this.pendingAttachments.length === 0) || this.capturing) {
      return;
    }

    this.capturing = true;
    this.updateCaptureState();

    try {
      const embeds: string[] = [];

      for (let i = 0; i < this.pendingAttachments.length; i += 1) {
        const attachment = this.pendingAttachments[i];

        if (attachment) {
          const path = await this.plugin.saveAttachment(this.selectedDate, attachment.file, i);
          embeds.push(`![[${path}]]`);
        }
      }

      const body = [text, embeds.join("\n")].filter(Boolean).join("\n\n");
      await this.plugin.addMoment(this.selectedDate, body);

      this.textareaEl.value = "";
      this.clearAttachments();
      await this.refreshTimeline();
      this.textareaEl.focus();
    } catch (error) {
      console.error(error);
      new Notice("Could not save this moment.");
    } finally {
      this.capturing = false;
      this.updateCaptureState();
    }
  }

  private clearAttachments(): void {
    for (const attachment of this.pendingAttachments) {
      URL.revokeObjectURL(attachment.url);
    }

    this.pendingAttachments = [];

    if (this.attachmentsEl) {
      this.attachmentsEl.empty();
    }
  }

  private async refreshTimeline(): Promise<void> {
    if (!this.listEl) {
      return;
    }

    const moments = await this.plugin.readMoments(this.selectedDate);
    this.listEl.empty();

    if (moments.length === 0) {
      const empty = this.listEl.createDiv({ cls: "momentlog-empty" });
      empty.createEl("strong", { text: "Your day starts here." });
      empty.createEl("p", {
        text: "Write a quick note or add a photo above, then select Record."
      });
      empty.createEl("p", {
        text: `Moments are saved to ${this.plugin.getDailyFilePath(this.selectedDate)}.`,
        cls: "momentlog-empty-path"
      });
      return;
    }

    const sourcePath = this.plugin.getDailyFilePath(this.selectedDate);

    for (const momentEntry of moments) {
      const entry = this.listEl.createDiv({ cls: "momentlog-entry" });
      const header = entry.createDiv({ cls: "momentlog-entry-header" });
      header.createDiv({ text: momentEntry.time, cls: "momentlog-time" });

      const mobileMenu = header.createEl("button", {
        cls: "momentlog-entry-menu",
        attr: { "aria-label": "More actions", title: "More actions" }
      });
      setIcon(mobileMenu, "ellipsis");

      const showActionsMenu = (event: MouseEvent): void => {
        const menu = new Menu();

        menu.addItem((item) =>
          item
            .setTitle("Edit")
            .setIcon("pencil")
            .onClick(() => {
              this.openEditModal(momentEntry);
            })
        );

        menu.addItem((item) =>
          item
            .setTitle("Delete")
            .setIcon("trash-2")
            .onClick(() => {
              this.confirmDelete(momentEntry);
            })
        );

        menu.showAtMouseEvent(event);
      };

      mobileMenu.addEventListener("click", (event) => {
        event.stopPropagation();
        showActionsMenu(event);
      });

      const card = entry.createDiv({ cls: "momentlog-card" });
      const rendered = card.createDiv({ cls: "momentlog-entry-content" });
      await MarkdownRenderer.render(
        this.app,
        momentEntry.content,
        rendered,
        sourcePath,
        this
      );

      rendered.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        image.addClass("momentlog-viewable-image");
        image.setAttribute("role", "button");
        image.setAttribute("tabindex", "0");
        image.setAttribute("aria-label", image.alt ? `View image: ${image.alt}` : "View image");

        const openViewer = (): void => {
          new ImageViewerModal(this.app, image.src, image.alt).open();
        };

        image.addEventListener("click", openViewer);
        image.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openViewer();
          }
        });
      });

      const actions = card.createDiv({ cls: "momentlog-actions" });

      const edit = actions.createEl("button", {
        cls: "momentlog-entry-action",
        attr: { "aria-label": "Edit", title: "Edit" }
      });
      setIcon(edit, "pencil");
      edit.addEventListener("click", () => {
        this.openEditModal(momentEntry);
      });

      const remove = actions.createEl("button", {
        cls: "momentlog-entry-action",
        attr: { "aria-label": "Delete", title: "Delete" }
      });
      setIcon(remove, "trash-2");
      remove.addEventListener("click", () => {
        this.confirmDelete(momentEntry);
      });
    }
  }

  private openEditModal(momentEntry: MomentlogMoment): void {
    new EditMomentModal(this.app, momentEntry, async (content) => {
      await this.plugin.updateMoment(this.selectedDate, momentEntry, content);
      await this.refreshTimeline();
    }).open();
  }

  private confirmDelete(momentEntry: MomentlogMoment): void {
    if (!window.confirm("Delete this moment?")) {
      return;
    }

    void this.plugin.deleteMoment(this.selectedDate, momentEntry).then(() => {
      void this.refreshTimeline();
    });
  }
}

class ImageViewerModal extends Modal {
  private readonly src: string;
  private readonly alt: string;
  private scale = 1;
  private translateX = 0;
  private translateY = 0;
  private imageEl!: HTMLImageElement;
  private zoomLabelEl!: HTMLElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; translateX: number; translateY: number } | null = null;
  private pinchStartDistance = 0;
  private pinchStartScale = 1;

  constructor(app: App, src: string, alt: string) {
    super(app);
    this.src = src;
    this.alt = alt;
  }

  onOpen(): void {
    this.modalEl.addClass("momentlog-image-modal");
    this.contentEl.addClass("momentlog-image-modal-content");

    const stage = this.contentEl.createDiv({ cls: "momentlog-image-stage" });
    this.imageEl = stage.createEl("img", {
      cls: "momentlog-image-full",
      attr: {
        src: this.src,
        alt: this.alt || "Momentlog image",
        draggable: "false"
      }
    });

    const controls = this.contentEl.createDiv({ cls: "momentlog-image-controls" });

    const zoomOut = controls.createEl("button", {
      cls: "momentlog-image-control",
      attr: { "aria-label": "Zoom out", title: "Zoom out" }
    });
    setIcon(zoomOut, "minus");

    this.zoomLabelEl = controls.createDiv({ cls: "momentlog-image-zoom-label" });

    const zoomIn = controls.createEl("button", {
      cls: "momentlog-image-control",
      attr: { "aria-label": "Zoom in", title: "Zoom in" }
    });
    setIcon(zoomIn, "plus");

    const reset = controls.createEl("button", {
      cls: "momentlog-image-control",
      attr: { "aria-label": "Reset zoom", title: "Reset zoom" }
    });
    setIcon(reset, "maximize-2");

    zoomOut.addEventListener("click", () => this.setScale(this.scale / 1.35));
    zoomIn.addEventListener("click", () => this.setScale(this.scale * 1.35));
    reset.addEventListener("click", () => this.resetView());

    stage.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.setScale(this.scale * (event.deltaY < 0 ? 1.12 : 0.88));
      },
      { passive: false }
    );

    stage.addEventListener("dblclick", () => {
      if (this.scale > 1) {
        this.resetView();
      } else {
        this.setScale(2.5);
      }
    });

    stage.addEventListener("pointerdown", (event) => {
      stage.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size === 1) {
        this.dragStart = {
          x: event.clientX,
          y: event.clientY,
          translateX: this.translateX,
          translateY: this.translateY
        };
      }

      if (this.pointers.size === 2) {
        this.pinchStartDistance = this.pointerDistance();
        this.pinchStartScale = this.scale;
        this.dragStart = null;
      }
    });

    stage.addEventListener("pointermove", (event) => {
      if (!this.pointers.has(event.pointerId)) {
        return;
      }

      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size === 2) {
        const distance = this.pointerDistance();

        if (this.pinchStartDistance > 0) {
          this.setScale(this.pinchStartScale * (distance / this.pinchStartDistance));
        }

        return;
      }

      if (this.pointers.size === 1 && this.dragStart && this.scale > 1) {
        this.translateX =
          this.dragStart.translateX + event.clientX - this.dragStart.x;
        this.translateY =
          this.dragStart.translateY + event.clientY - this.dragStart.y;
        this.applyTransform();
      }
    });

    const finishPointer = (event: PointerEvent): void => {
      this.pointers.delete(event.pointerId);

      if (this.pointers.size === 1) {
        const remaining = Array.from(this.pointers.values())[0];

        if (remaining) {
          this.dragStart = {
            x: remaining.x,
            y: remaining.y,
            translateX: this.translateX,
            translateY: this.translateY
          };
        }
      } else {
        this.dragStart = null;
      }

      if (this.pointers.size < 2) {
        this.pinchStartDistance = 0;
      }
    };

    stage.addEventListener("pointerup", finishPointer);
    stage.addEventListener("pointercancel", finishPointer);

    this.resetView();
  }

  onClose(): void {
    this.pointers.clear();
    this.contentEl.empty();
  }

  private setScale(value: number): void {
    this.scale = Math.min(5, Math.max(1, value));

    if (this.scale === 1) {
      this.translateX = 0;
      this.translateY = 0;
    }

    this.applyTransform();
  }

  private resetView(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.applyTransform();
  }

  private applyTransform(): void {
    if (!this.imageEl || !this.zoomLabelEl) {
      return;
    }

    this.imageEl.style.transform =
      `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    this.zoomLabelEl.setText(`${Math.round(this.scale * 100)}%`);
  }

  private pointerDistance(): number {
    const points = Array.from(this.pointers.values());

    if (points.length < 2 || !points[0] || !points[1]) {
      return 0;
    }

    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }
}

class EditMomentModal extends Modal {
  private momentEntry: MomentlogMoment;
  private onSave: (content: string) => Promise<void>;

  constructor(
    app: App,
    momentEntry: MomentlogMoment,
    onSave: (content: string) => Promise<void>
  ) {
    super(app);
    this.momentEntry = momentEntry;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Edit ${this.momentEntry.time}` });

    const textarea = contentEl.createEl("textarea", {
      cls: "momentlog-modal-textarea"
    });
    textarea.value = this.momentEntry.content;

    const actions = contentEl.createDiv({ cls: "momentlog-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const save = actions.createEl("button", {
      text: "Save",
      cls: "mod-cta"
    });

    const submit = async (): Promise<void> => {
      const value = textarea.value.trim();

      if (!value) {
        return;
      }

      save.disabled = true;

      try {
        await this.onSave(value);
        this.close();
      } catch (error) {
        console.error(error);
        new Notice("Could not update this moment.");
        save.disabled = false;
      }
    };

    save.addEventListener("click", () => {
      void submit();
    });

    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void submit();
      }
    });

    window.setTimeout(() => textarea.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class MomentlogSettingTab extends PluginSettingTab {
  private plugin: MomentlogPlugin;

  constructor(app: App, plugin: MomentlogPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("momentlog-settings");

    containerEl.createEl("h2", { text: "Momentlog" });
    containerEl.createEl("p", {
      text: "Capture the small moments that are easy to lose: what you're doing, what just happened, a quick thought, or a photo you want to remember. Momentlog keeps capture fast and stores everything as ordinary Markdown in your vault.",
      cls: "momentlog-settings-intro"
    });

    const quickStart = containerEl.createDiv({ cls: "momentlog-settings-guide" });
    quickStart.createEl("h3", { text: "Quick start" });
    const quickStartList = quickStart.createEl("ol");
    quickStartList.createEl("li", {
      text: "Open Momentlog. On desktop, select the clock icon in the left ribbon. On mobile, open the ribbon/menu and select Momentlog. You can always use the Command palette and run Open Momentlog."
    });
    quickStartList.createEl("li", {
      text: "Write a short note, or paste, drag, or choose one or more photos."
    });
    quickStartList.createEl("li", {
      text: "Select Record. Your newest moment appears at the top of today's timeline."
    });

    new Setting(quickStart)
      .setName("Open Momentlog")
      .setDesc("Jump straight to today's capture view.")
      .addButton((button) =>
        button
          .setButtonText("Open")
          .setCta()
          .onClick(() => {
            void this.plugin.openMomentlog(true);
          })
      );

    const dailyNotes = containerEl.createDiv({ cls: "momentlog-settings-guide" });
    dailyNotes.createEl("h3", { text: "Use Momentlog with Daily Notes" });
    dailyNotes.createEl("p", {
      text: "Momentlog works on its own, but it can also share the same daily Markdown file as Obsidian's Daily Notes core plugin."
    });

    const dailyNotesList = dailyNotes.createEl("ol");
    dailyNotesList.createEl("li", {
      text: "Enable the Daily Notes core plugin in Obsidian."
    });
    dailyNotesList.createEl("li", {
      text: "In Daily Notes settings, set New file location to Momentlog and Date format to YYYY-MM-DD."
    });
    dailyNotesList.createEl("li", {
      text: "Keep the Momentlog folder and file format below set to those same values."
    });

    dailyNotes.createEl("p", {
      text: "Already have an existing Daily Notes folder or date format? Keep it. Just set Momentlog below to match your current Daily Notes settings instead.",
      cls: "momentlog-settings-note"
    });

    containerEl.createEl("h3", { text: "Storage" });

    new Setting(containerEl)
      .setName("Daily note folder")
      .setDesc("Folder where Momentlog stores one Markdown file per day. Match your Daily Notes new-file location if you want both to share the same note.")
      .addText((text) =>
        text
          .setPlaceholder("Momentlog")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Daily note file format")
      .setDesc("Date format used for each Markdown file name. Match your Daily Notes date format when sharing the same files.")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.fileNameFormat)
          .onChange(async (value) => {
            this.plugin.settings.fileNameFormat = value.trim() || "YYYY-MM-DD";
            await this.plugin.saveSettings();
          })
      );

    const source = containerEl.createDiv({ cls: "momentlog-settings-guide momentlog-settings-guide-muted" });
    source.createEl("h3", { text: "Your notes stay yours" });
    source.createEl("p", {
      text: "Momentlog does not use a database or cloud service. Entries remain readable Markdown, and images stay as files in your vault even if you disable the plugin."
    });
  }
}
