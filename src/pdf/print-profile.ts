export interface PrintProfileElement {
	feed?: number;
	max?: number;
	color?: string;
	italic?: boolean;
	style?: string;
	padding?: number;
	feed_with_last_section?: boolean;
	level_indent?: number;
}

export interface PrintProfile {
	paper_size: string;
	font_size: number;
	lines_per_page: number;
	top_margin: number;
	page_width: number;
	page_height: number;
	left_margin: number;
	right_margin: number;
	font_width: number;
	font_height: number;
	line_spacing: number;
	page_number_top_margin: number;
	dual_max_factor: number;
	title_page: {
		top_start: number;
		left_side: string[];
		right_side: string[];
	};
	scene_heading: { feed: number; max: number };
	action: { feed: number; max: number };
	shot: PrintProfileElement;
	character: PrintProfileElement;
	parenthetical: PrintProfileElement;
	dialogue: PrintProfileElement;
	transition: PrintProfileElement;
	centered: PrintProfileElement;
	synopsis: PrintProfileElement;
	section: PrintProfileElement & { level_indent: number };
	note: { color?: string; italic?: boolean };
	[key: string]: unknown;
}

export const US_LETTER_PROFILE: PrintProfile = {
	paper_size: 'letter',
	font_size: 12,
	lines_per_page: 55,
	top_margin: 1.0,
	page_width: 8.5,
	page_height: 11,
	left_margin: 1.5,
	right_margin: 1,
	font_width: 0.1,
	font_height: 0.1667,
	line_spacing: 1,
	page_number_top_margin: 0.5,
	dual_max_factor: 0.75,
	title_page: {
		top_start: 3.5,
		left_side: ['notes', 'copyright'],
		right_side: ['draft date', 'date', 'contact'],
	},
	scene_heading: { feed: 1.5, max: 61 },
	action: { feed: 1.5, max: 61 },
	shot: { feed: 1.5, max: 61 },
	character: { feed: 3.5, max: 33 },
	parenthetical: { feed: 3, max: 26 },
	dialogue: { feed: 2.5, max: 36 },
	transition: { feed: 0.0, max: 61 },
	centered: { feed: 1.5, style: 'center', max: 61 },
	synopsis: {
		feed: 0.5,
		max: 61,
		italic: true,
		color: '#888888',
		padding: 0,
		feed_with_last_section: true,
	},
	section: {
		feed: 0.5,
		max: 61,
		color: '#555555',
		level_indent: 0.2,
	},
	note: { color: '#888888', italic: true },
};
