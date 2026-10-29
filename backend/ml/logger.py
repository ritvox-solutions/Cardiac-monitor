"""Centralized logging configuration for the ML pipeline.

Provides a consistent logging interface across all modules with
both console and optional file output.
"""

import logging
import sys
from pathlib import Path


LOG_FORMAT: str = "%(asctime)s | %(levelname)-8s | %(name)-18s | %(message)s"
DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"


def setup_logger(
    name: str,
    log_file: str | Path | None = None,
    level: int = logging.INFO,
) -> logging.Logger:
    """Create and return a configured logger instance.

    Parameters
    ----------
    name : str
        Logger name (typically ``__name__``).
    log_file : str | Path | None, optional
        Optional path to a log file.  If provided, logs are written
        to both the console and the file.
    level : int, optional
        Logging level, by default ``logging.INFO``.

    Returns
    -------
    logging.Logger
        Configured logger ready for use.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    if logger.handlers:
        return logger

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    if log_file is not None:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(str(log_path), mode="a", encoding="utf-8")
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger
