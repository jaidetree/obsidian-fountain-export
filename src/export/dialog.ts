export async function showSaveDialog(defaultName: string): Promise<string | null> {
	const electronRemote = (require('electron') as any).remote;
	const dialog = electronRemote
		? electronRemote.dialog
		: (require('@electron/remote') as any).dialog;

	const result = await (dialog as any).showSaveDialog({
		defaultPath: defaultName,
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
	});

	if (result.canceled) return null;
	return (result.filePath as string | undefined) ?? null;
}
