#!/usr/bin/env python3
"""Public-facing copy helpers: em-dash cleanup and paragraph leading-dash removal."""

from __future__ import annotations

import re

EM_DASH = '\u2014'
EM_DASH_ENTITY_RE = re.compile(r'&(?:mdash|#8212|#x2014);', re.I)
ARTICLE_BODY_RE = re.compile(
    r'(<div class="article-body"[^>]*>)(.*?)(</div>)',
    re.S | re.I,
)
ARTICLE_HERO_RE = re.compile(
    r'(<figure class="article-hero"[^>]*>.*?<img\b[^>]*\balt=")([^"]*)(")',
    re.S | re.I,
)
ARTICLE_TITLE_RE = re.compile(
    r'(<h1 class="article-title">)(.*?)(</h1>)',
    re.S | re.I,
)
HTML_ATTR_COPY_RE = re.compile(
    r'(\b(?:data-title|data-description|alt|aria-label|placeholder|title)=)(["\'])(.*?)\2',
    re.I | re.S,
)
TITLE_TAG_RE = re.compile(r'(<title>)(.*?)(</title>)', re.S | re.I)
PARAGRAPH_TAG_RE = re.compile(r'(<p\b[^>]*>)(.*?)(</p>)', re.S | re.I)
SCRIPT_OR_STYLE_RE = re.compile(
    r'(<script[\s\S]*?</script>|<style[\s\S]*?</style>)',
    re.I,
)
LEADING_PARAGRAPH_DASH_RE = re.compile(
    r'^(?:(?:\s|&[^;]+;)+)?(?:—|--|-\s+-|-)\s*',
    re.I,
)


def normalize_em_dash_characters(text: str) -> str:
    text = EM_DASH_ENTITY_RE.sub(EM_DASH, text)
    text = re.sub(r'\s*[–—]\s*', f' {EM_DASH} ', text)
    text = re.sub(rf'{EM_DASH}(\w)', rf'{EM_DASH} \1', text)
    text = re.sub(rf'(\w){EM_DASH}', rf'\1 {EM_DASH}', text)
    text = re.sub(rf'\s*{EM_DASH}\s*', f' {EM_DASH} ', text)
    return text


def sanitize_em_dash_prose(text: str) -> str:
    """Rewrite em dashes into commas, colons, or parentheses for natural flow."""
    text = normalize_em_dash_characters(text)
    if EM_DASH not in text:
        return text

    while True:
        match = re.search(rf' {EM_DASH} ([^{EM_DASH}]+?) {EM_DASH} ', text)
        if not match:
            break
        inner = match.group(1).strip()
        text = text[: match.start()] + f' ({inner}) ' + text[match.end() :]

    replacements = [
        (rf' {EM_DASH} (and|but|or)\b', r', \1'),
        (rf' {EM_DASH} (who|which|where|when)\b', r', \1'),
        (rf' {EM_DASH} (how|what|whether|why)\b', r': \1'),
        (rf' {EM_DASH} (it|their|two|we|I)\b', r': \1'),
        (rf' {EM_DASH} (a|an|the|her|his|my|your)\b', r', \1'),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)

    text = re.sub(rf' {EM_DASH} ', ', ', text)
    text = text.replace(EM_DASH, ', ')
    text = re.sub(r',\s*,+', ',', text)
    text = re.sub(r',\s+([,.;:!?])', r'\1', text)
    text = re.sub(r':\s+,', ':', text)
    text = re.sub(r'\(\s+,', '(', text)
    return text


def strip_leading_paragraph_dashes(text: str) -> str:
    cleaned = LEADING_PARAGRAPH_DASH_RE.sub('', text, count=1)
    cleaned = re.sub(r'^(-\s*){2,}', '', cleaned)
    return cleaned


def polish_copy_fragment(text: str) -> str:
    return strip_leading_paragraph_dashes(sanitize_em_dash_prose(text))


def _sanitize_html_text_nodes(fragment: str, tag: str) -> str:
    pattern = re.compile(rf'<{tag}>(.*?)</{tag}>', re.S | re.I)

    def repl(match: re.Match[str]) -> str:
        return f'<{tag}>{polish_copy_fragment(match.group(1))}</{tag}>'

    return pattern.sub(repl, fragment)


def sanitize_article_content_html(html: str) -> str:
    """Strip em dashes from visible article fields (body, title, hero alt)."""

    def body_repl(match: re.Match[str]) -> str:
        inner = match.group(2)
        inner = _sanitize_html_text_nodes(inner, 'p')
        inner = _sanitize_html_text_nodes(inner, 'li')
        inner = _sanitize_html_text_nodes(inner, 'blockquote')
        return match.group(1) + inner + match.group(3)

    html = ARTICLE_BODY_RE.sub(body_repl, html)

    def title_repl(match: re.Match[str]) -> str:
        return match.group(1) + polish_copy_fragment(match.group(2)) + match.group(3)

    html = ARTICLE_TITLE_RE.sub(title_repl, html)

    def hero_repl(match: re.Match[str]) -> str:
        return match.group(1) + polish_copy_fragment(match.group(2)) + match.group(3)

    html = ARTICLE_HERO_RE.sub(hero_repl, html)
    return html


def _sanitize_paragraph_tags(fragment: str) -> str:
    def repl(match: re.Match[str]) -> str:
        inner = polish_copy_fragment(match.group(2))
        return match.group(1) + inner + match.group(3)

    return PARAGRAPH_TAG_RE.sub(repl, fragment)


def _sanitize_copy_attributes(fragment: str) -> str:
    def repl(match: re.Match[str]) -> str:
        quote = match.group(2)
        value = polish_copy_fragment(match.group(3))
        return f'{match.group(1)}{quote}{value}{quote}'

    return HTML_ATTR_COPY_RE.sub(repl, fragment)


def _sweep_title_tags(fragment: str) -> str:
    def repl(match: re.Match[str]) -> str:
        return match.group(1) + polish_copy_fragment(match.group(2)) + match.group(3)

    return TITLE_TAG_RE.sub(repl, fragment)


def _sweep_html_fragment(fragment: str) -> str:
    fragment = _sanitize_copy_attributes(fragment)
    fragment = _sanitize_paragraph_tags(fragment)
    return _sweep_title_tags(fragment)


def sweep_html_document(html: str) -> str:
    """Sanitize public copy in HTML while preserving script/style blocks."""
    html = sanitize_article_content_html(html)
    chunks: list[str] = []
    last = 0
    for match in SCRIPT_OR_STYLE_RE.finditer(html):
        chunks.append(_sweep_html_fragment(html[last : match.start()]))
        chunks.append(match.group(0))
        last = match.end()
    chunks.append(_sweep_html_fragment(html[last:]))
    return ''.join(chunks)
