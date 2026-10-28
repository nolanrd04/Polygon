"""
When each server-granted buff was active during one wave, for buff-aware
validation. Built once per wave in WaveService.complete_wave from
token.bundle_buffs. Validators ask for a stat over a frame range and never
need to know what a buff is. See frontend/documentation/BUFFS.md.

Frames are the client's wave-validation counter (logic ticks since the token
was issued), the same clock BuffContainer counts durations in.
"""

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

from app.core.buff_data import LOGIC_HZ, get_buff, ms_to_ticks
from app.models.flagged_wave import FlagReason

# A mid-wave grant only starts on the client once the pickup response arrives,
# some ticks after the frame it reported, so its window ends that much later.
GRANT_LATENCY_TICKS = 2 * LOGIC_HZ


@dataclass
class _Window:
    start: int
    end: int
    values: Dict[str, float] = field(default_factory=dict)


class BuffTimeline:
    def __init__(self) -> None:
        self._windows: Dict[str, List[_Window]] = {}

    @classmethod
    def from_grants(
        cls,
        grants: List[Dict],
        wave_start_frame: Optional[int],
        last_frame: int,
    ) -> "tuple[BuffTimeline, int, List[FlagReason]]":
        """
        Resolves each grant's start frame and adds them in start order.
        A queued grant (picked up in the shop) starts on the wave's start
        frame, which the client reports. That report is bounded to
        [latest queued granted_frame, last_frame], so a lie only moves
        windows, never lengthens them. Returns (timeline, start frame used, flags).
        """
        timeline = cls()
        queued_floor = max((g["granted_frame"] for g in grants if g.get("queued")), default=0)
        start = queued_floor if wave_start_frame is None else wave_start_frame
        start = max(queued_floor, min(start, max(last_frame, queued_floor)))

        resolved = []
        for g in grants:
            if g.get("queued"):
                resolved.append((start, g["duration_ticks"], g))
            else:
                resolved.append((g["granted_frame"], g["duration_ticks"] + GRANT_LATENCY_TICKS, g))
        resolved.sort(key=lambda r: r[0])

        flags = []
        for frame, duration, g in resolved:
            flag = timeline.validate_buff(g["id"], frame, duration, g.get("stats") or {})
            if flag:
                flags.append(flag)
        return timeline, start, flags

    def validate_buff(
        self, buff_id: str, start_frame: int, duration_ticks: int, stats: Dict[str, float]
    ) -> Optional[FlagReason]:
        """
        Checks one grant and adds it to the timeline. Grants must be added in
        start order. Mirrors BuffContainer.add: reapplying a non-stacking buff
        keeps the later end, a stacking one adds the time, maxDuration caps
        the remaining time, and stat values keep the larger magnitude.
        The ledger is server-written and its frames are bounded at grant
        time, so the only thing left to reject is a def that no longer exists.
        """
        buff = get_buff(buff_id)
        if not buff:
            return FlagReason(
                category="buffs",
                severity="medium",
                description=f"Granted buff has no definition: {buff_id}",
                actual=buff_id,
            )
        if duration_ticks <= 0:
            return None

        values = {e["stat"]: stats.get(e["stat"], e["value"]) for e in buff.get("stats", [])}
        cap = ms_to_ticks(buff["maxDuration"]) if "maxDuration" in buff else None
        windows = self._windows.setdefault(buff_id, [])
        last = windows[-1] if windows else None

        if last and last.end > start_frame:
            remaining = last.end - start_frame
            remaining = remaining + duration_ticks if buff.get("stacking") else max(remaining, duration_ticks)
            merged = dict(last.values)
            for stat, value in values.items():
                if abs(value) > abs(merged.get(stat, 0)):
                    merged[stat] = value
            last.end = start_frame
            end = start_frame + (min(remaining, cap) if cap is not None else remaining)
            windows.append(_Window(start_frame, end, merged))
        else:
            ticks = min(duration_ticks, cap) if cap is not None else duration_ticks
            windows.append(_Window(start_frame, start_frame + ticks, values))
        return None

    def together(self, buff_ids: Iterable[str]) -> List[Tuple[int, int]]:
        """
        The frame ranges [start, end] where every listed buff was active at
        once. Empty if any of them was never granted. Used to check a damage
        bucket's signature, which the client stamps at fire time.
        """
        ranges: Optional[List[Tuple[int, int]]] = None
        for buff_id in buff_ids:
            windows = [(w.start, w.end) for w in self._windows.get(buff_id, [])]
            if ranges is None:
                ranges = windows
                continue
            ranges = [
                (max(a_start, b_start), min(a_end, b_end))
                for a_start, a_end in ranges
                for b_start, b_end in windows
                if max(a_start, b_start) <= min(a_end, b_end)
            ]
        return sorted(ranges or [])

    def apply(
        self, stat: str, base: float, frame_from: int, frame_to: int,
        buff_ids: Optional[Iterable[str]] = None,
    ) -> float:
        """
        The highest value `stat` reaches at any frame in [frame_from, frame_to],
        with the client's formula (base + Σadd) × (1 + Σmult). Only positive
        values count: a ceiling should never shrink because a debuff might
        have been active. `buff_ids` limits it to those buffs (a damage
        bucket's signature); the server's windows run a little long, so an
        unfiltered query could credit a buff the projectile never had.
        """
        only = set(buff_ids) if buff_ids is not None else None
        overlapping = [
            (buff_id, w)
            for buff_id, windows in self._windows.items()
            if only is None or buff_id in only
            for w in windows
            if w.values.get(stat, 0) > 0 and w.start <= frame_to and w.end >= frame_from
        ]
        if not overlapping:
            return base

        best = base
        for point in {max(frame_from, w.start) for _, w in overlapping}:
            per_buff: Dict[str, float] = {}
            for buff_id, w in overlapping:
                if w.start <= point <= w.end:
                    per_buff[buff_id] = max(per_buff.get(buff_id, 0), w.values[stat])
            add = mult = 0.0
            for buff_id, value in per_buff.items():
                effect = next(e for e in get_buff(buff_id)["stats"] if e["stat"] == stat)
                if effect.get("isMultiplier"):
                    mult += value
                else:
                    add += value
            best = max(best, (base + add) * (1 + mult))
        return best