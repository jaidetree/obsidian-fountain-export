import { Plugin, Notice } from 'obsidian';
import { runExport } from './export/runner';

export function registerCommands(plugin: Plugin): void {
	plugin.addCommand({
		id: 'export-fountain-to-pdf',
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Fountain" is a proper noun (screenplay format)
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
