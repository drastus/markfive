Markfive
========

Markfive is a lightweight markup language that compiles to semantic HTML. It
looks similar to Markdown, but it covers many more HTML elements (`<dfn>`,
`<kbd>`, `<samp>`, `<cite>`, `<mark>`, `<time>`, `<ruby>`, …), has
first-class footnotes, tables with merged cells, MathML output and
language-aware typography.


Syntax
======

Paragraphs and line breaks
--------------------------

Paragraphs are separated by blank lines. Unlike Markdown, every line break
inside a paragraph is kept (rendered as `<br>`):

	First line of a paragraph.
	Second line of the same paragraph.

	Another paragraph.

Inside a line, `{/}` inserts a line break (`<br>`) and `{/?}` a word-break
opportunity (`<wbr>`).

A thematic break (`<hr>`) is a `* * *` line followed by a blank line.

Headings
--------

A heading is a line underlined with at least three characters. The underline
character sets the level:

	Document title
	**************

	Chapter
	=======

	Subchapter
	----------

	Section
	.......

| Underline | Element |
|-----------|---------|
| `***`     | `<h1>`  |
| `===`     | `<h2>`  |
| `---`     | `<h3>`  |
| `...`     | `<h4>`  |

A heading must be followed by a blank line. A single line placed between the
heading and the blank line becomes a subtitle and the pair is wrapped in
`<hgroup>`:

	Chapter 2
	=========
	Subtitle

Every heading of level 2 or lower opens a `<section>` that lasts until the
next heading of the same or higher level. Each heading gets an `id` generated
from its text (`Chapter 2` → `chapter_2`); duplicates are made unique. Use
`--heading-shift=N` to render all headings N levels lower.

Attributes
----------

HTML attributes are written in braces:

	{#id .class1.class2 lang=en title="Quoted value" data-foo='bar' hidden}

- `#name` sets the `id`,
- `.name` adds classes (several can be chained: `.a.b`),
- `name=value` sets an attribute (quote the value if it contains spaces),
- a bare `name` sets an empty attribute.

**Block attributes** go on their own line directly before the block:

	{style="color: orange"}
	A paragraph with a style.

	{.compact}
	- First item
	- Second item

	{#custom-id}
	Heading with a custom id
	------------------------

An attributes line at the very top of the file, followed by a blank line,
applies to the whole document (e.g. `{lang=fr}` sets the language used for
typography).

Block markers accept attributes right after the marker: `""{.note}`,
``` ``{.language-js} ```, `??{.box}`, `@main{#content}`, `-{.done} item`,
`1.{.done} item`, `|{.total} cell`.

**Inline attributes** go right after the closing marker:
`*word*{lang=en}`, `[link](url){target=_blank}`, `?[text]?{.highlight}`.

Inline formatting
-----------------

| Markfive          | HTML                         |
|-------------------|------------------------------|
| `*strong*`        | `<strong>`                   |
| `~emphasis~`      | `<em>`                       |
| `#bold#`          | `<b>`                        |
| `/italic/`        | `<i>`                        |
| `__underline__`   | `<u>`                        |
| `--strikeout--`   | `<s>`                        |
| `=highlight=`     | `<mark>`                     |
| `''Title''`       | `<cite>`                     |
| `:term:`          | `<dfn>`                      |
| `:term:(Title)`   | `<dfn title="Title">`        |
| `` `code` ``      | `<code>`                     |
| `>command>`       | `<kbd>`                      |
| `<output<`        | `<samp>`                     |
| `$x$`             | `<var>` (or MathML, see [Math](#math)) |
| `x^2^`            | `<sup>`                      |
| `H_2_O`           | `<sub>`                      |
| `?[text]?`        | `<span>`                     |
| `[[Enter]]`       | key (`<kbd class="mf-key">`) |
| `[[Ctrl]+[C]]`    | key combination              |
| `[\|OK\|]`        | button (`<kbd class="mf-button"><samp>`) |
| `[\|File\|Save\|]`| menu path                    |

Markers only work at word boundaries: the opening marker must not be preceded
by a letter or digit and the closing marker must not be followed by one, so
`parag~raph` stays literal. To format part of a word, wrap the content in
brackets: `#[J]#ava#[S]#cript`. Superscript and subscript are the exception –
they work inside words (`km^2^`), but content containing spaces must be
bracketed: `sli^[ce of text]^`.

`*strong*`, `~emphasis~`, `=highlight=` and `?[span]?` can be nested in
themselves: `~outer ~inner~ outer~`.

Other inline HTML elements are written as `@element[content]`:

	@abbr[HTML]{title="HyperText Markup Language"}
	@small[fine print]
	@del[removed] @ins[added]
	@bdi[user name]
	@ruby[漢 @rt[kan]]
	@time[today](2025-07-30)
	@data[five](5)

Supported elements are `abbr`, `bdi`, `data`, `del`, `ins`, `rt`, `ruby`,
`small` and `time`. For `time` and `data` the value in parentheses becomes the
`datetime` and `value` attribute respectively.

Links and images
----------------

	[link text](https://example.com)
	[link text](https://example.com){target=_blank}
	&[alt text](image.png){.class}

If the alt text of an image contains formatting, the image is rendered as
`<object role="img">` with the formatted content as its fallback.

Notes
-----

Footnotes are written inline and collected at the end of the document:

	Some claim[*][Source of the claim.].

The number of asterisks selects an independent series of notes: `[*]` is
numbered `1, 2, 3`, `[**]` uses `a, b, c` and `[***]` uses `A, B, C`.

A note can be given an `id` and then referenced again:

	First mention[*][The note.]{#src}. Second mention[*](#src).

Lists
-----

	- Unordered item
	- Another item
		- Nested item (indented with a tab)

	1. Ordered item
	2. Another item
	5. Item with value 5

Numbers that don't continue the sequence are kept as the `value` attribute. A
blank line between two items at the same level starts a new list.

To put several blocks in one item, leave the marker empty and indent the
content:

	1. Item 1
	2.
		First paragraph of item 2.

		Second paragraph of item 2.
	3. Item 3

Description lists
-----------------

Terms start with `:` and descriptions with `=`:

	: Apartment
		= An execution context grouping threads with COM objects.
	: Flat
		= A deflated tire.

Alternatively, a line ending with a colon followed by an indented line forms a
term-description pair:

	Fuzzy logic:
		gradual transition between "perfect falsity" and "perfect truth"

Block quotes
------------

	""
		A quotation. It can contain

		several paragraphs and other blocks.

	"" A one-line quotation.

Code, keyboard input and sample output
--------------------------------------

A code block (`<pre><code>`) starts with ``` `` ``` and its content is
indented. Whitespace and indentation inside it are preserved:

	``
		if n < 0:
			raise ValueError()

	`` print('A one-line code block')

Lines starting with `>` form a keyboard input block (`<pre><kbd>`) and lines
starting with `<` a sample output block (`<pre><samp>`):

	> npm install
	> npm start

	< added 42 packages in 2s

Divs and other blocks
---------------------

`??` creates a `<div>` containing the indented blocks:

	??{.box}
		A paragraph in a div.

		??{.inner}
			A nested div.

	??{.one-liner} A one-line div.

	??{.empty}

`@header`, `@main`, `@footer`, `@aside`, `@address`, `@pre`, `@del` and
`@ins` create the corresponding HTML element around their indented content.
Inside `@pre` whitespace is preserved.

	@main
		Main content.

		@pre
			Pre    formatted
			       text

Tables
------

In a simple table each line is a row; `!` starts a header cell and `|` a data
cell:

	! Name   ! Position
	| Chao   | Intern
	| Nguyễn | Worker

Each `>` after the cell marker makes the cell span one more column. A `^`
after the marker merges the cell with the one above it (its content, if any,
is appended to that cell):

	! First name ! Last name ! Paid
	| Bob        | Smith     | 600
	|^           |^ p.v.     | 400
	|> Total                 | 1000

In a complex table rows are separated with lines starting with `|-` (any
further `-` and `|` characters are ignored, so they can be used to draw the
grid) and every cell can be written on its own line:

	|-------|--------|-----
	! Title ! Author ! Year
	|-------|--------|-----
	| The Title
	| Author
	| 2015

Cell attributes go right after the cell marker: `|{.highlight} 2025`.

Math
----

Math is rendered to MathML with [Temml](https://temml.org/). A display
formula is a line starting with `$$` (the closing `$$` is optional); inline
math is enclosed in single dollars:

	$$ E = \frac{mc^2}{\sqrt{1-\frac{v^2}{c^2}}} $$

	Here, $E$ is energy. Similar equation is $E=mc^2$.

An inline formula consisting only of letters (`$x$`) is rendered as a simple
`<var>`.

LaTeX syntax is supported, extended with a few shortcuts:

- `a / b` is a fraction; parentheses around the numerator or denominator are
  dropped: `(-b \pm \sqrt{b^2 - 4ac}) / 2a`,
- `√{x}` and `∛{x}` are square and cube roots,
- braces after a set operator are literal: `S ⊂ {a, b, c}`.

Comments
--------

Comments are not rendered:

	// A one-line comment.

	//
		A commented-out block.

		- including a list

Variables
---------

`{{name}}` is replaced with the value passed on the command line as
`--name=value`. Undefined variables are replaced with an empty string.

Typography
----------

Unless `--no-typography` is given, the following replacements are made outside
of code:

| Input              | Output                                  |
|--------------------|-----------------------------------------|
| `"text"`, `'text'` | quotation marks of the current language |
| `...`              | `…`                                     |
| `---`              | `—` (em dash)                           |
| `3--5`             | `3–5` (en dash)                         |
| `-15`              | `−15` (minus sign)                      |
| `5'`, `12''`       | `5′`, `12″` (primes)                    |
| `1600 x 900`       | `1600 × 900`                            |
| `<<text>>`         | `«text»`                                |
| `<text>`           | `‹text›`                                |

The language is taken from the nearest `lang` attribute (English by default),
e.g. `"text"` becomes `“text”` in English and `„text“` with `{lang=de}`. For
French, narrow no-break spaces are added before `?`, `!`, `:` and inside guillemets.

Escaping
--------

A backslash before a marker makes it literal: `\*not strong\*`. A backslash
at the beginning of a line prevents it from being interpreted as a block
marker:

	\- Not a list item
	\* * *

Use `\\` for a literal backslash followed by a working marker.


Usage
=====

Building:

	npm run build

Develop mode (faster builds, watching for changes):

	npm run dev

Running test:

	markfive test/test.mf

Writing test to HTML file:

	markfive test/test.mf > test/test.part.html
	markfive --preview test/test.mf > test/test.html
