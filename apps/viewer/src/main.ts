import { readTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

const preview = document.querySelector<HTMLIFrameElement>("#preview")!;
const welcome = document.querySelector<HTMLElement>("#welcome")!;
const previewPanel = document.querySelector<HTMLElement>("#preview-panel")!;
const fileName = document.querySelector<HTMLElement>("#file-name")!;
const errorToast = document.querySelector<HTMLElement>("#error-toast")!;
const openButtons = document.querySelectorAll<HTMLButtonElement>("#open-file, #welcome-open");

async function chooseDiagram(): Promise<void> {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Archify diagram", extensions: ["html", "htm"] }],
    });
    if (typeof selected !== "string") return;
    const html = await readTextFile(selected);
    preview.srcdoc = html;
    welcome.hidden = true;
    previewPanel.hidden = false;
    fileName.textContent = selected.split(/[\\/]/).pop() || selected;
    errorToast.hidden = true;
  } catch (error) {
    errorToast.textContent = `Could not open this HTML file: ${String(error)}`;
    errorToast.hidden = false;
  }
}

for (const button of openButtons) button.addEventListener("click", () => void chooseDiagram());

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void chooseDiagram();
  }
});
