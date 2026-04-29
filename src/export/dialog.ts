interface SaveDialogFilter { name: string; extensions: string[] }
interface SaveDialogResult { canceled: boolean; filePath?: string }
interface SaveDialogOptions { defaultPath?: string; filters?: SaveDialogFilter[] }
interface ElectronDialog { showSaveDialog(opts: SaveDialogOptions): Promise<SaveDialogResult> }
interface ElectronModule { remote?: { dialog: ElectronDialog }; dialog?: ElectronDialog }

function getDialog(): ElectronDialog {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Electron runtime API; no ESM import path available
	const electron = require('electron') as ElectronModule;
	if (electron.remote?.dialog) return electron.remote.dialog;
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- @electron/remote runtime fallback; no ESM import path available
	return (require('@electron/remote') as ElectronModule).dialog as ElectronDialog;
}

export async function showSaveDialog(defaultName: string): Promise<string | null> {
	const dialog = getDialog();
	const result = await dialog.showSaveDialog({
		defaultPath: defaultName,
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
	});
	if (result.canceled) return null;
	return result.filePath ?? null;
}
