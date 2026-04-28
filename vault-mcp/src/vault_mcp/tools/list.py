"""List tools (projects, memory)."""

from pathlib import Path
from typing import TypedDict

from vault_mcp.config import Settings


class ProjectInfo(TypedDict):
    name: str
    path: str
    has_index: bool
    specs_count: int
    decisions_count: int
    bugs_count: int


class MemoryInfo(TypedDict):
    name: str
    type: str
    description: str


def _count_md(folder: Path) -> int:
    if not folder.exists():
        return 0
    return sum(1 for f in folder.iterdir() if f.is_file() and f.suffix == ".md")


def list_projects(settings: Settings) -> list[ProjectInfo]:
    """List all projects in 01-Projects/."""
    projects_dir = settings.vault_path / "01-Projects"
    if not projects_dir.exists():
        return []

    out: list[ProjectInfo] = []
    for project_path in sorted(p for p in projects_dir.iterdir() if p.is_dir()):
        out.append(
            ProjectInfo(
                name=project_path.name,
                path=f"01-Projects/{project_path.name}",
                has_index=(project_path / "_index.md").exists(),
                specs_count=_count_md(project_path / "Specs"),
                decisions_count=_count_md(project_path / "Decisions"),
                bugs_count=_count_md(project_path / "Bugs"),
            )
        )
    return out


def _parse_frontmatter_fields(content: str) -> tuple[str, str]:
    lines = content.splitlines()
    type_ = ""
    desc = ""
    in_fm = False
    for line in lines[:30]:
        stripped = line.strip()
        if stripped == "---":
            in_fm = not in_fm
            if not in_fm:
                break
            continue
        if not in_fm:
            continue
        if stripped.startswith("type:"):
            type_ = stripped.split(":", 1)[1].strip().strip('"').strip("'")
        elif stripped.startswith("description:"):
            desc = stripped.split(":", 1)[1].strip().strip('"').strip("'")
    return type_, desc


def list_memory(settings: Settings) -> list[MemoryInfo]:
    """List all memory files with their type and description from frontmatter."""
    mem_dir = settings.vault_path / "02-Meta" / "Claude" / "Memory"
    if not mem_dir.exists():
        return []

    out: list[MemoryInfo] = []
    for f in sorted(mem_dir.iterdir()):
        if not f.is_file() or f.suffix != ".md":
            continue
        if f.name.startswith("_"):
            continue
        if f.name == "MEMORY.md":
            continue
        type_, desc = _parse_frontmatter_fields(f.read_text(encoding="utf-8"))
        out.append(MemoryInfo(name=f.name, type=type_, description=desc))
    return out
