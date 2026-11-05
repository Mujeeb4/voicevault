"""Gentle background-noise reduction for voice-cloning samples (ffmpeg only).

highpass removes rumble/handling noise below the voice range; afftdn removes
steady broadband noise (hum, hiss, fans) while tracking the noise floor as it
changes. The settings are deliberately mild: heavy denoising leaves a watery
artefact that a voice clone would learn and reproduce.
"""
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

DENOISE_FILTER = 'highpass=f=70,afftdn=nr=12:nf=-35:tn=1'


def denoise_for_cloning(source, target) -> Path:
    """Write a denoised MP3 copy of ``source``; return the original if ffmpeg fails.

    Denoising is an enhancement, so a failure here never blocks cloning.
    """
    source, target = Path(source), Path(target)
    try:
        process = subprocess.run(
            ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(source), '-vn',
             '-af', DENOISE_FILTER, '-c:a', 'libmp3lame', '-b:a', '192k', str(target)],
            capture_output=True, timeout=180, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning('Denoise skipped: %s', exc.__class__.__name__)
        return source
    if process.returncode or not target.exists() or not target.stat().st_size:
        logger.warning('Denoise skipped: ffmpeg could not process the sample')
        return source
    return target
