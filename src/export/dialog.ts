import { dialog } from '@electron/remote';

export async function showSaveDialog(defaultName: string): Promise<string | null> {
	const result = await dialog.showSaveDialog({
		defaultPath: defaultName,
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
	});
	if (result.canceled) return null;
	return result.filePath ?? null;
}
