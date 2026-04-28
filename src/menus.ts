import { Plugin, TFile, Menu } from 'obsidian';
import { runExport } from './export/runner';

export function registerMenus(plugin: Plugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
			menu.addItem((item) => {
				item
					.setTitle('Export to PDF')
					.setIcon('file-output')
					.onClick(async () => {
						await runExport(plugin, file);
					});
			});
		})
	);
}
