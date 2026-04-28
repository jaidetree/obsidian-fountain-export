import { Plugin, Notice } from 'obsidian';
import { runExport } from './export/runner';

export function registerCommands(plugin: Plugin): void {
	plugin.addCommand({
		id: 'export-fountain-to-pdf',
		name: 'Export Fountain to PDF',
		callback: async () => {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('No file is currently open.');
				return;
			}
			await runExport(plugin, activeFile);
		},
	});
}
