from __future__ import annotations

from config.settings import load_settings
from pipeline.sim_update_pipeline import run_sim_update_pipeline


if __name__ == "__main__":
    settings = load_settings()

    result = run_sim_update_pipeline(
        username=settings.USERNAME,
        settings=settings,
    )

    print(result)