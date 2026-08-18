#!/usr/bin/env python3
"""End-to-end processor for the Geography lesson-one pilot."""

import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PILOT_SUBJECT = "Geografia"
PILOT_ORDER = 1
DEFAULT_DRIVE_ID = "16ikDG560clJixXEeKl-615otamtefwkI"
PROMPT_VERSION = 2
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"


def require_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Secret/variável obrigatória ausente: {name}")
    return value


def http_json(url, method="GET", headers=None, payload=None, timeout=120):
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"HTTP {error.code} em {url}: {detail}") from error


class SupabaseRest:
    def __init__(self):
        self.url = require_env("SUPABASE_URL").rstrip("/")
        key = require_env("SUPABASE_SERVICE_KEY")
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def select(self, table, query):
        return http_json(f"{self.url}/rest/v1/{table}?{query}", headers=self.headers)

    def upsert(self, table, record, conflict):
        headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=representation"}
        query = urllib.parse.urlencode({"on_conflict": conflict})
        return http_json(f"{self.url}/rest/v1/{table}?{query}", "POST", headers, record)

    def update(self, table, record, filters):
        headers = {**self.headers, "Prefer": "return=representation"}
        return http_json(f"{self.url}/rest/v1/{table}?{filters}", "PATCH", headers, record)

    def pilot_lesson(self):
        subject_query = urllib.parse.urlencode({"select": "id,name", "name": f"eq.{PILOT_SUBJECT}"})
        subjects = self.select("subjects", subject_query)
        if len(subjects or []) != 1:
            raise RuntimeError("Não foi possível localizar uma única matéria Geografia.")
        lesson_query = urllib.parse.urlencode({
            "select": "id,title,drive_url,order_index",
            "subject_id": f"eq.{subjects[0]['id']}",
            "order_index": f"eq.{PILOT_ORDER}",
        })
        lessons = self.select("lessons", lesson_query)
        if len(lessons or []) != 1:
            raise RuntimeError("Não foi possível localizar uma única Aula 1 de Geografia.")
        return lessons[0]


def download_video(drive_id, destination):
    print("::group::Baixando vídeo do Google Drive", flush=True)
    attempts = [
        [
            "curl", "--fail", "--location", "--retry", "5", "--retry-all-errors",
            "--connect-timeout", "30", "--max-time", "7200",
            "--user-agent", "Mozilla/5.0", "--output", str(destination),
            f"https://drive.usercontent.google.com/download?id={drive_id}&export=download&confirm=t",
        ],
        [
            sys.executable, "-m", "gdown", "--no-cookies", "--fuzzy",
            f"https://drive.google.com/uc?id={drive_id}", "-O", str(destination),
        ],
        [
            sys.executable, "-m", "gdown", "--fuzzy",
            f"https://drive.google.com/file/d/{drive_id}/view", "-O", str(destination),
        ],
    ]
    errors = []
    for index, command in enumerate(attempts, 1):
        destination.unlink(missing_ok=True)
        print(f"Tentativa de download {index}/{len(attempts)}", flush=True)
        result = subprocess.run(command, check=False)
        if result.returncode == 0 and is_media_file(destination):
            print(f"Vídeo baixado: {destination.stat().st_size / 1024 / 1024:.1f} MB")
            print("::endgroup::", flush=True)
            return
        errors.append(f"tentativa {index}: código {result.returncode}")
    raise RuntimeError(
        "Não foi possível baixar um vídeo válido do Google Drive após três métodos ("
        + "; ".join(errors) + "). Confirme que o arquivo permite acesso sem login."
    )


def is_media_file(path):
    if not path.exists() or path.stat().st_size < 1024 * 1024:
        return False
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=format_name,duration",
        "-of", "json", str(path),
    ], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return False
    try:
        metadata = json.loads(result.stdout).get("format", {})
        return bool(metadata.get("format_name")) and float(metadata.get("duration", 0)) > 1
    except (ValueError, TypeError, json.JSONDecodeError):
        return False


def extract_audio(video, audio):
    print("::group::Extraindo áudio", flush=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y", "-i", str(video),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", str(audio),
    ], check=True)
    print(f"Áudio extraído: {audio.stat().st_size / 1024 / 1024:.1f} MB")
    print("::endgroup::", flush=True)


def transcribe(audio, model_name):
    print(f"::group::Transcrevendo localmente com faster-whisper ({model_name})", flush=True)
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 2)
    segments, info = model.transcribe(
        str(audio), language="pt", beam_size=5, vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500}, condition_on_previous_text=True,
    )
    lines = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            lines.append(f"[{segment.start:09.2f}–{segment.end:09.2f}] {text}")
    transcript = "\n".join(lines)
    if len(transcript) < 200:
        raise RuntimeError("A transcrição resultou em menos de 200 caracteres.")
    print(f"Idioma detectado: {info.language}; caracteres: {len(transcript)}")
    print("::endgroup::", flush=True)
    return transcript


def parse_model_json(content):
    content = content.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if fenced:
        content = fenced.group(1)
    return json.loads(content)


def deepseek_json(system, user):
    api_key = require_env("DEEPSEEK_API_KEY")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")
    result = http_json(DEEPSEEK_URL, "POST", {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }, {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0.1,
        "max_tokens": 4096,
    }, timeout=180)
    content = result.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise RuntimeError("O DeepSeek retornou uma resposta vazia.")
    return parse_model_json(content)


def chunks(text, max_chars=45000):
    lines, current, size = [], [], 0
    for line in text.splitlines():
        if current and size + len(line) + 1 > max_chars:
            lines.append("\n".join(current))
            current, size = [], 0
        current.append(line)
        size += len(line) + 1
    if current:
        lines.append("\n".join(current))
    return lines


def analyze_transcript(transcript):
    print("::group::Analisando conteúdo com DeepSeek", flush=True)
    system = (
        "Você analisa transcrições de aulas preparatórias para o CACD. Seja fiel ao texto, "
        "não invente conteúdo nem bibliografia e responda somente JSON válido."
    )
    partials = []
    transcript_chunks = chunks(transcript)
    for index, chunk in enumerate(transcript_chunks, 1):
        print(f"Analisando trecho {index}/{len(transcript_chunks)}", flush=True)
        partials.append(deepseek_json(system, f"""Analise este trecho da Aula 1 de Geografia. Retorne:
{{"summary":"resumo fiel","topics":["tópico específico"],"keywords":["termo"],"references":["somente obra ou autor explicitamente mencionado"]}}

TRECHO {index}/{len(transcript_chunks)}:
{chunk}"""))

    final = deepseek_json(system, f"""Consolide as análises parciais da Aula 1 de Geografia. Remova duplicatas e não acrescente fatos. Retorne:
{{"suggested_title":"título claro e específico","summary":"resumo estruturado da aula","topics":["tópico específico"],"keywords":["termo"],"references":["somente referência mencionada"]}}

ANÁLISES PARCIAIS:
{json.dumps(partials, ensure_ascii=False)}""")
    required = ("suggested_title", "summary", "topics", "keywords", "references")
    if any(key not in final for key in required) or not final["topics"]:
        raise RuntimeError("A análise final do DeepSeek não contém todos os campos obrigatórios.")
    for key in ("topics", "keywords", "references"):
        final[key] = list(dict.fromkeys(str(value).strip() for value in final[key] if str(value).strip()))
    print("::endgroup::", flush=True)
    return final


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--drive-id", default=DEFAULT_DRIVE_ID)
    parser.add_argument("--whisper-model", default=os.environ.get("WHISPER_MODEL", "small"))
    parser.add_argument("--rename-lesson", action="store_true")
    args = parser.parse_args()

    database = SupabaseRest()
    lesson = database.pilot_lesson()
    original_title = lesson["title"]
    print(f"Processando aula {lesson['id']}: {original_title}", flush=True)
    with tempfile.TemporaryDirectory(prefix="eduflow-geography-") as directory:
        directory = Path(directory)
        video, audio = directory / "lesson-video", directory / "lesson-audio.mp3"
        download_video(args.drive_id, video)
        extract_audio(video, audio)
        transcript = transcribe(audio, args.whisper_model)
        analysis = analyze_transcript(transcript)

    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")
    record = {
        "lesson_id": lesson["id"],
        "summary": str(analysis["summary"]).strip(),
        "suggested_title": str(analysis["suggested_title"]).strip()[:255],
        "topics": analysis["topics"][:30], "keywords": analysis["keywords"][:60],
        "references": analysis["references"][:30], "processing_status": "ready",
        "model": model, "transcription_model": f"faster-whisper/{args.whisper_model}",
        "prompt_version": PROMPT_VERSION, "content_hash": hashlib.sha256(transcript.encode()).hexdigest(),
        "original_title": original_title,
        "processed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    if args.rename_lesson:
        database.update("lessons", {"title": record["suggested_title"]}, f"id=eq.{lesson['id']}")
        print(f"Aula renomeada para: {record['suggested_title']}")

    output = Path("data/lesson-content/geography-lesson-1.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path("lesson-analysis.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    Path("lesson-transcript.txt").write_text(transcript, encoding="utf-8")
    print("Processamento concluído; análise pronta para ser versionada.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"::error::{error}", file=sys.stderr)
        raise
