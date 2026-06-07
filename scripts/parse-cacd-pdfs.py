#!/usr/bin/env python3
"""
Generates SQL files for CACD TPS years 2014-2023 from pre-downloaded PDF text files.
Handles gabarito parsing per year format and question extraction.
"""

import json, re, sys, os

BASE = "/root/.claude/projects/-home-user-eduflow/d9cb5502-e27e-599b-84be-eee0c12d318c/tool-results"

FILES = {
    2024: "mcp-Google_Drive-read_file_content-1780863093049.txt",
    2025: "mcp-Google_Drive-read_file_content-1780863094337.txt",
    2014: "mcp-Google_Drive-read_file_content-1780863063665.txt",
    2015: "mcp-Google_Drive-read_file_content-1780863068664.txt",
    2016: "mcp-Google_Drive-read_file_content-1780863069896.txt",
    2017: "mcp-Google_Drive-read_file_content-1780863074796.txt",
    2018: "mcp-Google_Drive-read_file_content-1780863076088.txt",
    2019: "mcp-Google_Drive-read_file_content-1780863081235.txt",
    2020: "mcp-Google_Drive-read_file_content-1780863082227.txt",
    2022: "mcp-Google_Drive-read_file_content-1780863086927.txt",
    2023: "mcp-Google_Drive-read_file_content-1780863088103.txt",
}

# Subject ranges per year (based on section headers found in PDFs)
# Format: (start_questao, end_questao, subject)
SUBJECT_RANGES = {
    2014: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2015: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2016: [
        (1, 10, "Língua Portuguesa"),
        (11, 17, "Língua Inglesa"),
        (18, 31, "Política Internacional"),
        (32, 45, "Geografia"),
        (46, 55, "História do Brasil"),
        (56, 66, "História Mundial"),
        (67, 73, "Direito Internacional Público"),
        # Second stage (different booklet)
    ],
    2017: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2018: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2019: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2020: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2022: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
    2024: [
        (1, 7, "Língua Portuguesa"),
        (8, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 33, "Geografia"),
        (34, 47, "História do Brasil"),
        (48, 58, "História Mundial"),
        (59, 63, "Direito Internacional Público"),
        (64, 68, "Economia"),
    ],
    2025: [
        (1, 7, "Língua Portuguesa"),
        (8, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 33, "Geografia"),
        (34, 47, "História do Brasil"),
        (48, 58, "História Mundial"),
        (59, 63, "Direito Internacional Público"),
        (64, 68, "Economia"),
    ],
    2023: [
        (1, 8, "Língua Portuguesa"),
        (9, 14, "Língua Inglesa"),
        (15, 26, "Política Internacional"),
        (27, 44, "Geografia"),
        (45, 50, "História do Brasil"),
        (51, 61, "História Mundial"),
        (62, 67, "Direito Internacional Público"),
        (68, 73, "Economia"),
    ],
}


def load_text(year):
    path = os.path.join(BASE, FILES[year])
    with open(path) as f:
        data = json.load(f)
    return data['fileContent']


def get_subject(year, qnum):
    ranges = SUBJECT_RANGES.get(year, [])
    for start, end, subj in ranges:
        if start <= qnum <= end:
            return subj
    return "Desconhecido"


def clean_text(s):
    """Remove markdown escapes and normalize whitespace."""
    s = re.sub(r'\\([_*\[\]()~`>#+=|{}.!\\-])', r'\1', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


# ─── Gabarito parsers ────────────────────────────────────────────────────────

def parse_gabarito_irbr(text):
    """Parse 2014/2015/2017/2018 format with 'GABARITOS OFICIAIS DEFINITIVOS'
    and 'Questão N' headers. Also handles continuation CE matrices (2016/2017)."""
    gab = {}
    gab_idx = max(text.find('GABARITOS OFICIAIS DEFINITIVOS'), text.find('GABARITO OFICIAL DEFINITIVO'))
    if gab_idx < 0:
        return gab
    gab_text = text[gab_idx:]
    lines = [l.strip() for l in gab_text.split('\n') if l.strip()]

    last_q = 0  # last questão number assigned
    pending_matrix = []  # CE values for questões without explicit headers

    i = 0
    while i < len(lines):
        line = lines[i]
        # Skip doc code lines (IRBR codes, || markers)
        clean = re.sub(r'\d*IRBR\S+|\d+_IRBR_\S+', '', line)
        clean = re.sub(r'\\+_IRBR\\+_\S+', '', clean)  # escaped underscores
        clean = re.sub(r'\|\|[^|]+\|\|', '', clean)
        clean = re.sub(r'IRBR', '', clean)  # any remaining IRBR

        q_nums = [int(m) for m in re.findall(r'Questão (\d+)', clean)]

        # Pure CE row with no questão headers → continuation matrix
        tokens = clean.split()
        ce_only = [t for t in tokens if t in ('C', 'E', 'X', '#', '0')]
        non_ce = [t for t in tokens if t not in ('C', 'E', 'X', '#', '0') and t.strip()]

        if not q_nums and ce_only and not non_ce:
            pending_matrix.extend([v for v in ce_only if v != '0'])
            i += 1
            continue

        if not q_nums:
            # Non-questão, non-CE line — flush pending matrix if any
            if pending_matrix and last_q > 0:
                q = last_q + 1
                for idx in range(0, len(pending_matrix), 4):
                    chunk = pending_matrix[idx:idx+4]
                    if not any(v in 'CEX#' for v in chunk):
                        break
                    for item_n, val in enumerate(chunk, 1):
                        if val in ('C', 'E', 'X', '#'):
                            gab[(q, item_n)] = val
                    q += 1
                pending_matrix = []
            i += 1
            continue

        # Collect CE values from this line
        ce_part = re.sub(r'Questão \d+', '', clean)
        line_ce = [v for v in ce_part.split() if v in ('C', 'E', 'X', '#')]

        # Flush pending_matrix only when we encounter questão headers WITH CE values
        # (header-only lines are table-of-contents, don't trigger flush)
        if pending_matrix and last_q > 0 and line_ce:
            q = last_q + 1
            for idx in range(0, len(pending_matrix), 4):
                if q >= min(q_nums):
                    break
                chunk = pending_matrix[idx:idx+4]
                if not any(v in 'CEX#' for v in chunk):
                    break
                for item_n, val in enumerate(chunk, 1):
                    if val in ('C', 'E', 'X', '#'):
                        gab[(q, item_n)] = val
                q += 1
            pending_matrix = []
        # Header-only lines: skip CE assignment, don't clear pending_matrix

        # Collect CE values from this line
        ce_line = re.sub(r'Questão \d+', '', clean)
        ce_vals = [v for v in ce_line.split() if v in ('C', 'E', 'X', '#')]

        # Absorb continuation lines that add more questão groups or more CE values
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            nxt_clean = re.sub(r'\d*IRBR\S+|\d+_IRBR_\S+', '', nxt)
            nxt_clean = re.sub(r'\\+_IRBR\\+_\S+', '', nxt_clean)
            nxt_clean = re.sub(r'\|\|[^|]+\|\|', '', nxt_clean)
            nxt_clean = re.sub(r'IRBR', '', nxt_clean)
            nxt_q = re.findall(r'Questão (\d+)', nxt_clean)
            nxt_tokens = nxt_clean.split()
            nxt_ce = [v for v in nxt_tokens if v in ('C', 'E', 'X', '#')]
            nxt_other = [v for v in nxt_tokens if v not in ('C', 'E', 'X', '#', '0') and v.strip()]

            if nxt_q:
                extra_nums = [int(m) for m in nxt_q]
                q_nums.extend(extra_nums)
                nxt_ce_part = re.sub(r'Questão \d+', '', nxt_clean)
                ce_vals.extend([v for v in nxt_ce_part.split() if v in ('C', 'E', 'X', '#')])
                j += 1
            elif nxt_ce and not nxt_other:
                ce_vals.extend(nxt_ce)
                j += 1
                if len(ce_vals) >= len(q_nums) * 4:
                    break
            else:
                break

        # Handle zero-padding
        if ce_vals.count('0') > 2:
            valid = []
            for k in range(0, len(ce_vals), 4):
                chunk = ce_vals[k:k+4]
                if any(v in 'CEX#' for v in chunk):
                    valid.extend(chunk)
            ce_vals = valid[:len(q_nums)*4]

        for qi, qnum in enumerate(q_nums):
            for item_n in range(1, 5):
                pos = qi * 4 + (item_n - 1)
                if pos < len(ce_vals) and ce_vals[pos] in ('C', 'E', 'X', '#'):
                    gab[(qnum, item_n)] = ce_vals[pos]

        # If there are extra CE values beyond what q_nums covers, save in pending_matrix
        extra_start = len(q_nums) * 4
        if extra_start < len(ce_vals):
            extra = [v for v in ce_vals[extra_start:] if v in ('C', 'E', 'X', '#')]
            pending_matrix.extend(extra)

        # Only update last_q when we actually assigned CE values from this group
        if q_nums and line_ce:
            last_q = max(q_nums)

        i = j if j > i else i + 1

    return gab


def parse_gabarito_iades(text, exam_type="A"):
    """Parse 2019/2020/2022/2023 format: 'Prova Tipo "A"' with QUESTÃO NN headers.
    Uses Unicode curly quotes “/” as found in the PDFs."""
    gab = {}
    lines = text.split('\n')
    in_tipo = False
    # Build search strings with Unicode curly quotes (U+201C / U+201D)
    target = f'Prova Tipo “{exam_type}”'
    other_pattern = re.compile(r'Prova Tipo “[ABCD]”')

    for line in lines:
        if target in line:
            in_tipo = True
        elif other_pattern.search(line) and target not in line:
            in_tipo = False

        if not in_tipo:
            continue

        q_nums = [int(m) for m in re.findall(r'QUESTÃO (\d+)', line)]
        if not q_nums:
            continue

        # Remove QUESTÃO markers, item numbers (1 2 3 4), exam type marker
        cleaned = re.sub(r'Prova Tipo "[ABCD]"', '', line)
        cleaned = re.sub(r'QUESTÃO \d+', '', cleaned)
        # Remove standalone 1-4 (item numbers)
        cleaned = re.sub(r'\b[1-4]\b', '', cleaned)
        tokens = [t for t in cleaned.split() if t in ('C', 'E', '#', 'X')]

        for qi, qnum in enumerate(q_nums):
            for item_n in range(1, 5):
                pos = qi * 4 + (item_n - 1)
                if pos < len(tokens):
                    val = tokens[pos]
                    if val in ('C', 'E'):
                        gab[(qnum, item_n)] = val
                    elif val in ('#', 'X'):
                        gab[(qnum, item_n)] = 'X'

    return gab


def parse_gabarito_2016(text):
    """Parse 2016 format.
    Stage 1 (Q1-31): raw CE matrix after document code '263\\_IRBR...001'
    Stage 2 (Q32-73): Questão headers with values inline, then continuation matrix for Q46-66
    """
    gab = {}

    lines = text.split('\n')

    # ── Stage 1: Q1-31 matrix ──────────────────────────────────────────────
    # Find first GABARITOS OFICIAIS DEFINITIVOS
    first_gab = -1
    for i, l in enumerate(lines):
        if 'GABARITOS OFICIAIS DEFINITIVOS' in l:
            first_gab = i
            break

    if first_gab >= 0:
        stage1_vals = []
        for i in range(first_gab, min(first_gab + 50, len(lines))):
            l = lines[i].strip()
            # Doc code line (may have escaped underscores)
            if 'IRBR' in l and '001' in l:
                continue
            if 'GABARITOS' in l or 'Obs' in l:
                continue
            tokens_all = l.split()
            tokens_ce = [t for t in tokens_all if t in ('C', 'E', 'X', '#', '0')]
            tokens_other = [t for t in tokens_all if t not in ('C', 'E', 'X', '#', '0')]
            if tokens_ce and not tokens_other:
                # Pure CE row
                stage1_vals.extend(tokens_ce)
            elif tokens_other:
                # Hit non-CE content, stop
                break

        # Assign Q1-31 (4 items each, 31*4 = 124, zeros are padding)
        q = 1
        for idx in range(0, len(stage1_vals), 4):
            if q > 31:
                break
            chunk = stage1_vals[idx:idx+4]
            # Skip all-zero padding groups
            if all(v == '0' for v in chunk):
                break
            for item_n, val in enumerate(chunk, 1):
                if val in ('C', 'E', 'X', '#'):
                    gab[(q, item_n)] = val
            q += 1

    # ── Stage 2: Q32-73 (Questão headers + matrix continuation) ───────────
    # Find second GABARITOS section
    second_gab = -1
    count = 0
    for i, l in enumerate(lines):
        if 'GABARITOS OFICIAIS DEFINITIVOS' in l:
            count += 1
            if count == 2:
                second_gab = i
                break

    if second_gab >= 0:
        # Parse Q32-45 and Q67-73 (have headers on same lines as CE values)
        gab2 = {}
        stage2_lines = [l.strip() for l in lines[second_gab:] if l.strip()]

        i = 0
        q46_66_vals = []
        parsing_q46_continuation = False

        while i < len(stage2_lines):
            l = stage2_lines[i]

            # Skip doc code lines
            if 'IRBR' in l and '002' in l:
                i += 1
                continue
            if 'GABARITOS' in l or 'Obs' in l or 'MINISTÉRIO' in l or 'INSTITUTO' in l or 'Justif' in l:
                i += 1
                continue

            q_nums = [int(m) for m in re.findall(r'Questão (\d+)', l)]

            if q_nums:
                parsing_q46_continuation = False
                # After Q45, the next Questão headers might be Q67
                # Q46-66 values are in the matrix rows between Q45 and Q67

                ce_part = re.sub(r'Questão \d+', '', l)
                ce_vals = [v for v in ce_part.split() if v in ('C', 'E', 'X', '#')]

                # Collect continuation CE lines
                j = i + 1
                while j < len(stage2_lines):
                    nxt = stage2_lines[j]
                    nxt_q = re.findall(r'Questão \d+', nxt)
                    nxt_tokens = nxt.split()
                    nxt_ce = [v for v in nxt_tokens if v in ('C', 'E', 'X', '#')]
                    nxt_other = [v for v in nxt_tokens if v not in ('C', 'E', 'X', '#')]

                    if nxt_q:
                        # Next questão group - check if it's Q67+ or Q46-66
                        next_nums = [int(m) for m in re.findall(r'Questão (\d+)', nxt)]
                        if max(q_nums) == 45 and min(next_nums) >= 67:
                            # Q46-66 values are in between as raw matrix
                            # Collect all pure CE rows until Q67 line
                            k = j
                            while k < len(stage2_lines):
                                midl = stage2_lines[k]
                                mid_q = re.findall(r'Questão \d+', midl)
                                if mid_q:
                                    break
                                mid_ce = [v for v in midl.split() if v in ('C', 'E', 'X', '#')]
                                mid_other = [v for v in midl.split() if v not in ('C', 'E', 'X', '#')]
                                if mid_ce and not mid_other:
                                    q46_66_vals.extend(mid_ce)
                                k += 1
                        break
                    elif nxt_ce and not nxt_other:
                        # Pure CE continuation - part of current questão group? or Q46-66 matrix?
                        if max(q_nums) <= 45:
                            # This is Q46-66 matrix, save for later
                            q46_66_vals.extend(nxt_ce)
                        j += 1
                    else:
                        break

                # Assign values to questões in current group
                for qi, qnum in enumerate(q_nums):
                    for item_n in range(1, 5):
                        pos = qi * 4 + (item_n - 1)
                        if pos < len(ce_vals) and ce_vals[pos] in ('C', 'E', 'X', '#'):
                            gab2[(qnum, item_n)] = ce_vals[pos]
                i = j if j > i else i + 1
            else:
                i += 1

        # Assign Q46-66 from matrix
        q = 46
        for idx in range(0, len(q46_66_vals), 4):
            if q > 66:
                break
            chunk = q46_66_vals[idx:idx+4]
            for item_n, val in enumerate(chunk, 1):
                if val in ('C', 'E', 'X', '#'):
                    gab2[(q, item_n)] = val
            q += 1

        gab.update(gab2)

    return gab


def parse_gabarito_2025(text):
    """Parse 2025 format: items numbered 1-240 globally in matrix form."""
    gab = {}  # {item_num: 'C'|'E'|'X'}

    gab_idx = text.find('GABARITOS OFICIAIS DEFINITIVOS')
    if gab_idx < 0:
        return gab

    # Only parse up to the justification section
    just_idx = text.find('Justificativas de alteração', gab_idx)
    gab_text = text[gab_idx:just_idx] if just_idx > 0 else text[gab_idx:]
    lines = [l.strip() for l in gab_text.split('\n') if l.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]
        tokens = line.split()

        # Skip junk lines
        if ('GABARITOS' in line or 'Obs' in line or line == 'Item'
                or line == 'Gabarito' or 'DIPLOMATA' in line or 'IRBR' in line
                or 'Aplicação' in line or 'CONCURSO' in line or 'CARGO' in line
                or 'PERÍODO' in line or 'PRIMEIRA' in line):
            i += 1
            continue

        # Skip all-zero rows
        if tokens and all(t == '0' for t in tokens):
            i += 1
            continue

        # Check for header lines with only numbers (item header rows) possibly ending with "Gabarito"
        non_zero_nums = [t for t in tokens if re.match(r'^\d+$', t) and t != '0' and int(t) >= 1]
        all_nums = all(re.match(r'^\d+$', t) or t in ('Gabarito', '0') for t in tokens)
        if all_nums and non_zero_nums and len(non_zero_nums) >= 10:
            # Pure number header - CE values on next line
            item_nums = [int(t) for t in non_zero_nums]
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                ce_vals = [v for v in next_line.split() if v in ('C', 'E', 'X', '#')]
                for item_n, item_num in enumerate(item_nums):
                    if item_n < len(ce_vals) and ce_vals[item_n] in ('C', 'E', 'X', '#'):
                        gab[item_num] = ce_vals[item_n]
                i += 2
            else:
                i += 1
            continue

        # Check for inline format: "21 22 23... C E E C..." (equal counts)
        nums_in_line = [int(t) for t in tokens if re.match(r'^\d+$', t) and 1 <= int(t) <= 240]
        ce_in_line = [v for v in tokens if v in ('C', 'E', 'X', '#')]
        if nums_in_line and ce_in_line and len(nums_in_line) == len(ce_in_line) and len(nums_in_line) >= 10:
            for item_num, ce_val in zip(nums_in_line, ce_in_line):
                if ce_val in ('C', 'E', 'X', '#'):
                    gab[item_num] = ce_val
            i += 1
            continue

        i += 1

    # Convert item gabarito to (questao, item) format: items 1-4 = Q1, 5-8 = Q2, etc.
    gab_q = {}
    for item_num, val in gab.items():
        if item_num < 1:
            continue
        qnum = (item_num - 1) // 4 + 1
        item_n = (item_num - 1) % 4 + 1
        gab_q[(qnum, item_n)] = val

    return gab_q


def parse_gabarito(year, text):
    if year == 2025:
        return parse_gabarito_2025(text)
    elif year in (2019, 2020, 2022, 2023):
        return parse_gabarito_iades(text, "A")
    elif year == 2016:
        return parse_gabarito_2016(text)
    else:
        return parse_gabarito_irbr(text)


# ─── Question extractor ───────────────────────────────────────────────────────

SUBJ_PATTERNS = [
    (r'LÍNGUA PORTUGUESA', 'Língua Portuguesa'),
    (r'LÍNGUA INGLESA|INGLÊS', 'Língua Inglesa'),
    (r'POLÍTICA INTERNACIONAL', 'Política Internacional'),
    (r'GEOGRAFIA', 'Geografia'),
    (r'HISTÓRIA DO BRASIL', 'História do Brasil'),
    (r'HISTÓRIA MUNDIAL', 'História Mundial'),
    (r'NOÇÕES DE DIREITO|DIREITO INTERNACIONAL', 'Direito Internacional Público'),
    (r'NOÇÕES DE ECONOMIA|ECONOMIA', 'Economia'),
]


def detect_subject(text_chunk):
    """Return canonical subject name or None."""
    for pattern, name in SUBJ_PATTERNS:
        if re.search(pattern, text_chunk, re.IGNORECASE):
            return name
    return None


def build_subject_map(text):
    """Build {qnum: subject} mapping by finding section headers in text."""
    # Collect all subject positions and all questão positions
    subj_positions = []
    for pattern, name in SUBJ_PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            subj_positions.append((m.start(), name))
    subj_positions.sort()

    q_positions = []
    for m in re.finditer(r'QUESTÃO (\d+)', text):
        q_positions.append((m.start(), int(m.group(1))))
    q_positions.sort()

    if not subj_positions:
        return {}

    # Assign each questão the most recent subject seen before it
    subj_map = {}
    si = 0
    current_subj = None
    for q_pos, qnum in q_positions:
        while si < len(subj_positions) and subj_positions[si][0] <= q_pos:
            current_subj = subj_positions[si][1]
            si += 1
        if current_subj:
            subj_map[qnum] = current_subj

    return subj_map


def extract_questions_2014plus(text, year):
    """Extract questões from 2014-2023 format PDFs."""
    questions = []
    subj_map = build_subject_map(text)

    # Split by QUESTÃO N or Questão N (2024+ uses lowercase)
    parts = re.split(r'\n(?=(?:QUESTÃO|Questão) \d+\n)', text)

    for part in parts:
        qm = re.match(r'(?:QUESTÃO|Questão) (\d+)\n', part)
        if not qm:
            continue

        qnum = int(qm.group(1))
        body = part[qm.end():]

        enunciado, items = split_enunciado_items(body)

        subj = subj_map.get(qnum) or get_subject(year, qnum)

        for item_n, item_text in enumerate(items, 1):
            questions.append({
                'qnum': qnum,
                'item_n': item_n,
                'subject': subj,
                'enunciado': clean_text(enunciado)[:500],
                'item_text': clean_text(item_text)[:800],
            })

    return questions


def split_enunciado_items(body):
    """Split questão body into enunciado and list of 4 item texts."""
    lines = body.split('\n')
    clean_lines = []
    for l in lines:
        s = l.strip()
        if s:
            clean_lines.append(s)

    # Find where items begin: a line that is just a digit 1-4
    item_start_idx = None
    for i, l in enumerate(clean_lines):
        if re.match(r'^[1-4]$', l):
            item_start_idx = i
            break

    if item_start_idx is None:
        # Try inline: "1 text 2 text ..."
        full = ' '.join(clean_lines)
        # Method 2: split on ". 2 " or ". 3 " etc.
        enunciado_part = full
        items = []
        # Try to find items inline
        marked = re.sub(r'\.\s+([2-4])\s+([A-ZÁÉÍÓÚÀÃÂÊÔÜ"\'(])', r'. §§\1§ \2', full)
        if '§§' in marked:
            parts = marked.split('§§')
            item0 = parts[0]
            # Find where items start in item0 (after enunciado + "1 ")
            m = re.search(r'\s1\s+([A-ZÁÉÍÓÚÀÃÂÊÔÜ"\'(])', item0)
            if m:
                enunciado_part = item0[:m.start()].strip()
                item0_text = item0[m.start():].strip()
                item0_text = re.sub(r'^\s*1\s+', '', item0_text)
                items.append(item0_text)
            else:
                enunciado_part = item0.strip()
            for p in parts[1:]:
                text = re.sub(r'^\d§\s*', '', p).strip()
                if text:
                    items.append(text)
        return enunciado_part, items[:4]

    enunciado = ' '.join(clean_lines[:item_start_idx])

    # Parse items: each item starts with a standalone digit
    items = []
    current_item = []
    for l in clean_lines[item_start_idx:]:
        if re.match(r'^[1-4]$', l):
            if current_item:
                items.append(' '.join(current_item))
            current_item = []
        else:
            current_item.append(l)
    if current_item:
        items.append(' '.join(current_item))

    return enunciado, items[:4]


def sql_str(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def row_to_sql(year, qnum, item_n, subject, enunciado, item_text, gabarito_val):
    enunciado_full = f"Q{qnum} Item {item_n} (TPS {year}): {enunciado} | {item_text}"
    enunciado_full = enunciado_full[:1000]
    gabarito = 'a' if gabarito_val == 'C' else 'b'
    return (
        f"  ('exam', {year}, {sql_str(subject)}, NULL, "
        f"{sql_str(enunciado_full)}, '{{\"a\":\"Certo\",\"b\":\"Errado\"}}'::jsonb, '{gabarito}', NULL)"
    )


def extract_questions_2025(text):
    """Extract questions from 2025 format where items are numbered globally (1-240)."""
    questions = []
    subj_map = {}

    # Find subject boundaries by scanning for headers
    # Build a list of (position, subject) pairs
    subj_positions = []
    for pattern, name in SUBJ_PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            subj_positions.append((m.start(), name))
    subj_positions.sort()

    # Find all items by their global number: "NN text..."
    # Items are preceded by their number at the start of a line
    # Find all item positions
    item_positions = []
    for m in re.finditer(r'(?:^|\n)(\d{1,3}) ([A-ZÁÉÍÓÚÀÃÂÊÔÜ"\'(])', text):
        num = int(m.group(1))
        if 1 <= num <= 240:
            item_positions.append((m.start(), num, m.start() + len(m.group(0)) - 1))
    item_positions.sort()

    # For each item, extract text up to the next item
    for idx, (pos, item_num, text_start) in enumerate(item_positions):
        if idx + 1 < len(item_positions):
            next_pos = item_positions[idx + 1][0]
        else:
            # Find gabarito section to stop at
            gab_pos = text.find('GABARITOS OFICIAIS DEFINITIVOS')
            next_pos = gab_pos if gab_pos > pos else len(text)

        item_text_raw = text[text_start:next_pos].strip()
        item_text_clean = clean_text(item_text_raw)[:800]

        # Get subject from position
        current_subj = None
        for s_pos, s_name in subj_positions:
            if s_pos <= pos:
                current_subj = s_name
        if not current_subj:
            current_subj = "Desconhecido"

        # Questão number and item number within questão
        qnum = (item_num - 1) // 4 + 1
        item_n = (item_num - 1) % 4 + 1

        # Enunciado: look for text before the first item of this questão
        first_item_num = (qnum - 1) * 4 + 1
        enunciado = ""
        if item_n == 1:
            # Find text between previous item end and this item
            if idx > 0:
                prev_pos = item_positions[idx - 1][0]
                prev_text_start = item_positions[idx - 1][2]
                # Text between prev item and this item (could be enunciado)
                mid = text[prev_text_start:pos].strip()
                enunciado = clean_text(mid)[:500]

        questions.append({
            'qnum': qnum,
            'item_n': item_n,
            'subject': current_subj,
            'enunciado': enunciado,
            'item_text': item_text_clean,
        })

    return questions


def process_year(year):
    print(f"\n[{year}] Loading text...", end=' ', flush=True)
    text = load_text(year)
    print(f"{len(text)} chars | ", end='', flush=True)

    print("Parsing gabarito...", end=' ', flush=True)
    gab = parse_gabarito(year, text)
    print(f"{len(gab)} entries | ", end='', flush=True)

    print("Extracting questions...", end=' ', flush=True)
    if year == 2025:
        questions = extract_questions_2025(text)
    else:
        questions = extract_questions_2014plus(text, year)
    print(f"{len(questions)} items", flush=True)

    rows = []
    missing_gab = 0
    for q in questions:
        qnum = q['qnum']
        item_n = q['item_n']
        gval = gab.get((qnum, item_n))
        if gval is None or gval not in ('C', 'E'):
            missing_gab += 1
            continue
        rows.append(row_to_sql(year, qnum, item_n, q['subject'], q['enunciado'], q['item_text'], gval))

    if missing_gab:
        print(f"  [{year}] WARNING: {missing_gab} items without gabarito (skipped)")

    return rows


def main():
    years = [int(y) for y in sys.argv[1:]] if len(sys.argv) > 1 else sorted(FILES.keys())

    os.makedirs('/home/user/eduflow/output', exist_ok=True)

    all_lines = []
    all_lines.append('-- CACD TPS 2014-2023 — gerado automaticamente')
    all_lines.append('')

    for year in years:
        if year not in FILES:
            print(f"[{year}] No file mapping, skipping")
            continue
        try:
            rows = process_year(year)
            if not rows:
                print(f"  [{year}] No rows generated!")
                continue

            all_lines.append(f"-- ─── TPS {year} ({len(rows)} itens) ──────────────────────")
            all_lines.append(f"DELETE FROM questions WHERE source = 'exam' AND year = {year};")
            all_lines.append("INSERT INTO questions (source, year, subject, topic, enunciado, opcoes, gabarito, explicacao) VALUES")
            all_lines.append(',\n'.join(rows))
            all_lines.append(';')
            all_lines.append('')

            # Write per-year file
            year_path = f'/home/user/eduflow/output/tps-{year}-full.sql'
            year_content = [
                f'-- CACD TPS {year}',
                f"DELETE FROM questions WHERE source = 'exam' AND year = {year};",
                "INSERT INTO questions (source, year, subject, topic, enunciado, opcoes, gabarito, explicacao) VALUES",
                ',\n'.join(rows),
                ';',
            ]
            with open(year_path, 'w') as f:
                f.write('\n'.join(year_content))
            print(f"  [{year}] Written: {year_path} ({len(rows)} rows)")

        except Exception as e:
            import traceback
            print(f"  [{year}] ERROR: {e}")
            traceback.print_exc()

    combined_path = '/home/user/eduflow/output/tps-2014-2023.sql'
    with open(combined_path, 'w') as f:
        f.write('\n'.join(all_lines))
    print(f"\nCombined SQL: {combined_path}")


if __name__ == '__main__':
    main()
