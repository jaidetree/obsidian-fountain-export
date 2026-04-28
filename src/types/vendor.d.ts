// Ambient type declarations for aw-parser and aw-liner.
// These packages ship no TypeScript types; the shapes below are derived from
// runtime inspection of the actual module exports.

declare module 'aw-parser' {

	/** A parsed Fountain token (scene heading, action, dialogue, etc.) */
	interface Token {
		type: string;
		text: string;
		start: number;
		end: number;
		line: number;
		/** Back-references to related tokens; may be circular. */
		lines: Token[];
		/** Section depth (only present on `section` tokens). */
		level?: number;
		/** Dual-dialogue marker (only present on `character` tokens). */
		dual?: boolean;
		/** Scene number (only present on `scene_heading` tokens). */
		number?: number;
		/** Returns true when this token's type matches the given string. */
		is(type: string): boolean;
		is_dialogue(): boolean;
		name(): string;
		location(): string;
		has_scene_time(): boolean;
		location_type(): string;
	}

	/** A single line produced by the liner (ready for PDF layout). */
	interface ScriptLine {
		type: string;
		text: string;
		/** Source token; has circular back-references, so avoid JSON.stringify. */
		token: Token;
		start: number;
		end: number;
		local_index: number;
		global_index: number;
		/** Scene number — only on `scene_heading` lines. */
		number?: number;
		/** True on `page_break` lines when the same scene continues on the next page. */
		scene_split?: boolean;
		/** Present on the left-column line of a dual-dialogue pair. */
		right_column?: ScriptLine[];
		is(type: string): boolean;
		is_dialogue(): boolean;
		name(): string;
		location(): string;
		has_scene_time(): boolean;
		location_type(): string;
	}

	interface ParsedScript {
		title_page: Token[];
		tokens: Token[];
		/** Populated by aw-liner after parsing. */
		lines: ScriptLine[];
	}

	interface ParseOptions {
		print_headers: boolean;
		print_actions: boolean;
		print_dialogues: boolean;
		print_notes: boolean;
		print_sections: boolean;
		print_synopsis: boolean;
		each_scene_on_new_page: boolean;
		double_space_between_scenes: boolean;
		use_dual_dialogue: boolean;
		merge_multiple_empty_lines: boolean;
	}

	interface Helpers {
		operators: unknown;
		fq: {
			is(type: string): boolean;
			is_dialogue(): boolean;
			name(): string;
			location(): string;
			has_scene_time(): boolean;
			location_type(): string;
		};
		first_text(tokens: Token[]): string;
		create_line(props: Partial<ScriptLine>): ScriptLine;
		create_token(props: Partial<Token>): Token;
		create_separator(line: number): Token;
	}

	const parser: {
		parse(text: string, options: ParseOptions): ParsedScript;
	};

	const helpers: Helpers;
}

declare module 'aw-liner' {

	import type { Helpers, Token, ScriptLine } from 'aw-parser';

	// Mirrors PrintProfile from src/pdf/print-profile.ts.
	// Kept inline because relative imports are not allowed inside ambient module
	// declarations (TypeScript error 2439). Structural typing ensures that
	// PrintProfile is assignable here without any explicit cast.
	interface LinerPrintProfile {
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
		title_page: { top_start: number; left_side: string[]; right_side: string[] };
		scene_heading: { feed: number; max: number };
		action: { feed: number; max: number };
		[key: string]: unknown;
	}

	interface LinerOptions {
		print: LinerPrintProfile;
		text_more: string;
		text_contd: string;
		split_dialogue: boolean;
	}

	class Liner {
		constructor(helpers: Helpers);
		line(tokens: Token[], options: LinerOptions): ScriptLine[];
	}

	export { Liner, LinerOptions };
}
