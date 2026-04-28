import { Menu, Plugin, TFile } from 'obsidian'
import { runExport } from './export/runner'

export function registerMenus(plugin: Plugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
			menu.addItem(item => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Fountain" is a proper noun (screenplay format)
				item.setTitle('Export Fountain to PDF…')
					.setIcon('file-output')
					.onClick(async () => {
						await runExport(plugin, file)
					})
			})
		}),
	)
}
