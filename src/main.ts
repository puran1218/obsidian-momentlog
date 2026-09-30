import {
  App,
  ItemView,
  MarkdownRenderer,
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

const VIEW_TYPE = "timelog-view";
const SECTION_HEADING = "## Timelog";
const ENTRY_PATTERN = /<!-- timelog-entry:([^\n]+) -->\s*\n### ([^\n]+)\s*\n\n?([\s\S]*?)\n<!-- \/timelog-entry -->/g;

interface TimelogSettings {
  folder: string;
  fileNameFormat: string;
}

interface TimelogMoment {
  id: string;
  time: string;
  content: string;
}

interface PendingAttachment {
  file: File;
  url: string;
}

const DEFAULT_SETTINGS: TimelogSettings = {
  folder: "Timelog",
  fileNameFormat: "YYYY-MM-DD"
};

export default class TimelogPlugin extends Plugin {
  settings: TimelogSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new TimelogView(leaf, this));

    this.addRibbonIcon("clock-3", "Open Timelog", () => {
      void this.openTimelog(false);
    });

    this.addCommand({
      id: "open-timelog",
      name: "Open Timelog",
      callback: () => {
        void this.openTimelog(false);
      }
    });

    this.addCommand({
      id: "capture-timelog",
      name: "Capture a moment",
      callback: () => {
        void this.openTimelog(true);
      }
    });

    this.addSettingTab(new TimelogSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async openTimelog(focusComposer: boolean): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];

    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE,
        active: true
      });
    }

    await this.app.workspace.revealLeaf(leaf);

    if (focusComposer && leaf.view instanceof TimelogView) {
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

  async readMoments(date: string): Promise<TimelogMoment[]> {
    const file = await this.getDailyFile(date);

    if (!file) {
      return [];
    }

    const content = await this.app.vault.cachedRead(file);
    const moments: TimelogMoment[] = [];
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

  async updateMoment(date: string, momentEntry: TimelogMoment, content: string): Promise<void> {
    const file = await this.getDailyFile(date);

    if (!file) {
      throw new Error("Daily note not found.");
    }

    const pattern = new RegExp(
      `<!-- timelog-entry:${this.escapeRegex(momentEntry.id)} -->[\\s\\S]*?<!-- \\/timelog-entry -->`
    );
    const replacement = this.buildEntryBlock(momentEntry.id, momentEntry.time, content);

    await this.app.vault.process(file, (source) => {
      if (!pattern.test(source)) {
        throw new Error("Timelog entry not found.");
      }

      return source.replace(pattern, replacement);
    });
  }

  async deleteMoment(date: string, momentEntry: TimelogMoment): Promise<void> {
    const file = await this.getDailyFile(date);

    if (!file) {
      return;
    }

    const pattern = new RegExp(
      `\\n?<!-- timelog-entry:${this.escapeRegex(momentEntry.id)} -->[\\s\\S]*?<!-- \\/timelog-entry -->\\n?`
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
    const data = (await this.loadData()) as Partial<TimelogSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private buildEntryBlock(id: string, time: string, content: string): string {
    return `<!-- timelog-entry:${id} -->\n### ${time}\n\n${content.trim()}\n<!-- /timelog-entry -->`;
  }

  private insertEntry(source: string, block: string): string {
    const headingPattern = /^## Timelog\s*$/m;
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

class TimelogView extends ItemView {
  private plugin: TimelogPlugin;
  private selectedDate = moment().format("YYYY-MM-DD");
  private textareaEl!: HTMLTextAreaElement;
  private recordButtonEl!: HTMLButtonElement;
  private dateEl!: HTMLElement;
  private attachmentsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private pendingAttachments: PendingAttachment[] = [];
  private capturing = false;

  constructor(leaf: WorkspaceLeaf, plugin: TimelogPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Daily timelog";
  }

  getIcon(): string {
    return "clock-3";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("timelog-view");
    this.buildToolbar();
    this.buildComposer();
    this.contentEl.createEl("h3", { text: "Timelog", cls: "timelog-heading" });
    this.listEl = this.contentEl.createDiv({ cls: "timelog-list" });

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
    const toolbar = this.contentEl.createDiv({ cls: "timelog-toolbar" });
    const previous = toolbar.createEl("button", {
      cls: "timelog-icon-button",
      attr: { "aria-label": "Previous day" }
    });
    setIcon(previous, "chevron-left");
    previous.addEventListener("click", () => {
      void this.changeDate(-1);
    });

    this.dateEl = toolbar.createDiv({ cls: "timelog-date" });

    const next = toolbar.createEl("button", {
      cls: "timelog-icon-button",
      attr: { "aria-label": "Next day" }
    });
    setIcon(next, "chevron-right");
    next.addEventListener("click", () => {
      void this.changeDate(1);
    });

    toolbar.createDiv({ cls: "timelog-spacer" });

    const today = toolbar.createEl("button", {
      text: "Today",
      cls: "timelog-today-button"
    });
    today.addEventListener("click", () => {
      this.selectedDate = moment().format("YYYY-MM-DD");
      this.updateDate();
      void this.refreshTimeline();
    });
  }

  private buildComposer(): void {
    const composer = this.contentEl.createDiv({ cls: "timelog-composer" });

    this.textareaEl = composer.createEl("textarea", {
      cls: "timelog-input",
      attr: {
        placeholder: "What are you doing right now?",
        "aria-label": "New timelog entry"
      }
    });

    this.attachmentsEl = composer.createDiv({ cls: "timelog-attachments" });

    const footer = composer.createDiv({ cls: "timelog-composer-footer" });
    const addImage = footer.createEl("button", {
      cls: "timelog-icon-button",
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
      cls: "mod-cta timelog-record-button"
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
      const item = this.attachmentsEl.createDiv({ cls: "timelog-attachment" });
      item.createEl("img", {
        attr: {
          src: attachment.url,
          alt: attachment.file.name || "Pending image"
        }
      });

      const remove = item.createEl("button", {
        cls: "timelog-attachment-remove",
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
      new Notice("Could not save this timelog entry.");
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
      this.listEl.createDiv({
        text: "Nothing here yet.",
        cls: "timelog-empty"
      });
      return;
    }

    const sourcePath = this.plugin.getDailyFilePath(this.selectedDate);

    for (const momentEntry of moments) {
      const entry = this.listEl.createDiv({ cls: "timelog-entry" });
      entry.createDiv({ text: momentEntry.time, cls: "timelog-time" });

      const card = entry.createDiv({ cls: "timelog-card" });
      const rendered = card.createDiv({ cls: "timelog-entry-content" });
      await MarkdownRenderer.render(
        this.app,
        momentEntry.content,
        rendered,
        sourcePath,
        this
      );

      const actions = card.createDiv({ cls: "timelog-actions" });

      const edit = actions.createEl("button", {
        cls: "timelog-entry-action",
        attr: { "aria-label": "Edit", title: "Edit" }
      });
      setIcon(edit, "pencil");
      edit.addEventListener("click", () => {
        new EditMomentModal(this.app, momentEntry, async (content) => {
          await this.plugin.updateMoment(this.selectedDate, momentEntry, content);
          await this.refreshTimeline();
        }).open();
      });

      const remove = actions.createEl("button", {
        cls: "timelog-entry-action",
        attr: { "aria-label": "Delete", title: "Delete" }
      });
      setIcon(remove, "trash-2");
      remove.addEventListener("click", () => {
        if (!window.confirm("Delete this timelog entry?")) {
          return;
        }

        void this.plugin.deleteMoment(this.selectedDate, momentEntry).then(() => {
          void this.refreshTimeline();
        });
      });
    }
  }
}

class EditMomentModal extends Modal {
  private momentEntry: TimelogMoment;
  private onSave: (content: string) => Promise<void>;

  constructor(
    app: App,
    momentEntry: TimelogMoment,
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
      cls: "timelog-modal-textarea"
    });
    textarea.value = this.momentEntry.content;

    const actions = contentEl.createDiv({ cls: "timelog-modal-actions" });
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
        new Notice("Could not update this timelog entry.");
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

class TimelogSettingTab extends PluginSettingTab {
  private plugin: TimelogPlugin;

  constructor(app: App, plugin: TimelogPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Daily note folder")
      .setDesc("Timelog stores one Markdown file per day here. Use your Daily Notes folder if you want both to share the same files.")
      .addText((text) =>
        text
          .setPlaceholder("Timelog")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Daily note file format")
      .setDesc("Moment.js date format used for the Markdown file name. The default is YYYY-MM-DD.")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.fileNameFormat)
          .onChange(async (value) => {
            this.plugin.settings.fileNameFormat = value.trim() || "YYYY-MM-DD";
            await this.plugin.saveSettings();
          })
      );
  }
}
