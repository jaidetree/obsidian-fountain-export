import awParser from 'aw-parser';
import { Liner } from 'aw-liner';
import { get_pdf } from '../pdf/pdfmaker';
import { US_LETTER_PROFILE } from '../pdf/print-profile';

const PARSER_OPTIONS: import('aw-parser').ParseOptions = {
	print_headers: true,
	print_actions: true,
	print_dialogues: true,
	print_notes: false,
	print_sections: false,
	print_synopsis: false,
	each_scene_on_new_page: false,
	double_space_between_scenes: false,
	use_dual_dialogue: true,
	merge_multiple_empty_lines: true,
};

const LINER_OPTIONS: import('aw-liner').LinerOptions = {
	print: US_LETTER_PROFILE,
	text_more: '(MORE)',
	text_contd: "(CONT'D)",
	split_dialogue: true,
};

const PDF_CONFIG = {
	print_title_page: true,
	print_header: '',
	print_footer: '',
	print_watermark: '',
	scene_continuation_top: false,
	scene_continuation_bottom: false,
	show_page_numbers: true,
	embolden_scene_headers: false,
	underline_scene_headers: false,
	number_sections: false,
	scenes_numbers: 'none' as const,
};

export function exportFountain(text: string, outputPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		try {
			const parsed = awParser.parser.parse(text, PARSER_OPTIONS);
			parsed.lines = new Liner(awParser.helpers).line(parsed.tokens, LINER_OPTIONS);

			get_pdf({
				parsed,
				print: US_LETTER_PROFILE,
				config: PDF_CONFIG,
				filepath: outputPath,
				callback: resolve,
			});
		} catch (err) {
			reject(err);
		}
	});
}
