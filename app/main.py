from __future__ import annotations

from config.device import get_runtime_device_id
from config.exchange_loader import get_enabled_exchanges
from config.settings import load_settings
from pipeline.account_snapshot_pipeline import run_account_snapshot_pipeline
from pipeline.bootstrap_pipeline import run_bootstrap_pipeline
from pipeline.buy_execution_pipeline import run_buy_execution_pipeline
from pipeline.buy_prepare_pipeline import run_buy_prepare_pipeline
from pipeline.end_of_day_reconcile_pipeline import run_end_of_day_reconcile_pipeline
from pipeline.forced_sell_pipeline import run_forced_sell_pipeline
from service.log_service import LogEvent, LogService
from service.scheduler_service import SchedulerService
from service.ui_log_helper import ui_log


def _run_manual_pipelines(settings) -> None:
    if not settings.MANUAL_TRIGGER_PIPELINES:
        ui_log("MAIN", "No manual pipelines configured")
        return

    ui_log("MAIN", "Running manual pipelines...")

    for pipeline_name in settings.MANUAL_TRIGGER_PIPELINES:
        if pipeline_name == "ACCOUNT_SNAPSHOT_POST_EU_BUY":
            result = run_account_snapshot_pipeline(
                settings=settings,
                snapshot_type="POST_EU_BUY",
            )
            ui_log(
                "MANUAL_PIPELINE",
                f"PIPELINE={pipeline_name} | "
                f"SUCCESS={result.SUCCESS} | "
                f"MESSAGE={result.MESSAGE}",
            )

        elif pipeline_name == "ACCOUNT_SNAPSHOT_POST_EU_CLOSE":
            result = run_account_snapshot_pipeline(
                settings=settings,
                snapshot_type="POST_EU_CLOSE",
            )
            ui_log(
                "MANUAL_PIPELINE",
                f"PIPELINE={pipeline_name} | "
                f"SUCCESS={result.SUCCESS} | "
                f"MESSAGE={result.MESSAGE}",
            )

        elif pipeline_name == "ACCOUNT_SNAPSHOT_EOD":
            result = run_account_snapshot_pipeline(
                settings=settings,
                snapshot_type="EOD",
            )
            ui_log(
                "MANUAL_PIPELINE",
                f"PIPELINE={pipeline_name} | "
                f"SUCCESS={result.SUCCESS} | "
                f"MESSAGE={result.MESSAGE}",
            )

        elif pipeline_name == "BUY_PREPARE":
            result = run_buy_prepare_pipeline(settings=settings)
            ui_log(
                "MANUAL_PIPELINE",
                f"PIPELINE={pipeline_name} | "
                f"SUCCESS={result.SUCCESS} | "
                f"MESSAGE={result.MESSAGE} | "
                f"TOTAL_PLANNED_BUY_COUNT={result.TOTAL_PLANNED_BUY_COUNT} | "
                f"EXCHANGE_PLANNED_SUMMARY={result.EXCHANGE_PLANNED_SUMMARY}",
            )

        elif pipeline_name == "BUY_EXECUTION":
            for exchange in get_enabled_exchanges():
                result = run_buy_execution_pipeline(
                    settings=settings,
                    exchange_code=exchange.EXCHANGE,
                )
                ui_log(
                    "MANUAL_PIPELINE",
                    f"PIPELINE={pipeline_name} | "
                    f"EXCHANGE={exchange.EXCHANGE} | "
                    f"SUCCESS={result.SUCCESS} | "
                    f"MESSAGE={result.MESSAGE} | "
                    f"SIGNAL_COUNT={result.SIGNAL_COUNT} | "
                    f"PLANNED_BUY_COUNT={result.PLANNED_BUY_COUNT} | "
                    f"EXECUTED_BUY_COUNT={result.EXECUTED_BUY_COUNT} | "
                    f"SKIPPED_SCOPE_COUNT={result.SKIPPED_SCOPE_COUNT} | "
                    f"SKIPPED_ALREADY_OPEN_COUNT={result.SKIPPED_ALREADY_OPEN_COUNT} | "
                    f"SKIPPED_SAME_DAY_COUNT={result.SKIPPED_SAME_DAY_COUNT} | "
                    f"SKIPPED_BUDGET_COUNT={result.SKIPPED_BUDGET_COUNT}",
                )

        elif pipeline_name == "END_OF_DAY_RECONCILE":
            result = run_end_of_day_reconcile_pipeline(settings=settings)
            ui_log(
                "MANUAL_PIPELINE",
                f"PIPELINE={pipeline_name} | "
                f"SUCCESS={result.SUCCESS} | "
                f"MESSAGE={result.MESSAGE} | "
                f"MANUAL_BUY_DETECTED_COUNT={result.MANUAL_BUY_DETECTED_COUNT} | "
                f"MANUAL_SELL_DETECTED_COUNT={result.MANUAL_SELL_DETECTED_COUNT} | "
                f"RUNTIME_CLOSED_COUNT={result.RUNTIME_CLOSED_COUNT} | "
                f"RUNTIME_OPENED_COUNT={result.RUNTIME_OPENED_COUNT}",
            )

        elif pipeline_name == "FORCED_SELL":
            for exchange in get_enabled_exchanges():
                result = run_forced_sell_pipeline(
                    settings=settings,
                    exchange_code=exchange.EXCHANGE,
                )
                ui_log(
                    "MANUAL_PIPELINE",
                    f"PIPELINE={pipeline_name} | "
                    f"EXCHANGE={exchange.EXCHANGE} | "
                    f"SUCCESS={result.SUCCESS} | "
                    f"MESSAGE={result.MESSAGE} | "
                    f"AGED_POSITION_COUNT={result.AGED_POSITION_COUNT} | "
                    f"ELIGIBLE_FORCED_SELL_COUNT={result.ELIGIBLE_FORCED_SELL_COUNT} | "
                    f"EXECUTED_FORCED_SELL_COUNT={result.EXECUTED_FORCED_SELL_COUNT}",
                )
        else:
            ui_log("MAIN", f"Unknown manual pipeline skipped: {pipeline_name}")


def main() -> None:
    settings = load_settings()
    settings.DEVICE_ID = get_runtime_device_id()
    log_service = LogService(settings)

    enabled_exchanges = get_enabled_exchanges()

    log_service.log(
        LogEvent(
            EVENT_TYPE="APP_BOOT",
            EVENT_STATUS="STARTED",
            MESSAGE="Application boot started.",
            DETAILS_JSON={},
        )
    )

    ui_log("BOOT", "=" * 60)
    ui_log("BOOT", "IBKR EXECUTION BOOT")
    ui_log("BOOT", "=" * 60)
    ui_log("BOOT", f"USERNAME={settings.USERNAME}")
    ui_log("BOOT", f"EMAIL={settings.EMAIL}")
    ui_log("BOOT", f"APP_TIMEZONE={settings.APP_TIMEZONE}")
    ui_log("BOOT", f"IBKR_MODE={settings.IBKR_MODE}")
    ui_log("BOOT", f"IBKR_HOST={settings.IBKR_HOST}")
    ui_log("BOOT", f"IBKR_PORT={settings.IBKR_PORT}")
    ui_log("BOOT", f"IBKR_CLIENT_ID={settings.IBKR_CLIENT_ID}")
    ui_log("BOOT", f"DEVICE_ID={settings.DEVICE_ID}")
    ui_log("BOOT", f"TOTAL_MAX_OPEN_POSITIONS={settings.TOTAL_MAX_OPEN_POSITIONS}")
    ui_log("BOOT", f"MAX_DAILY_TRADE_COUNT={settings.MAX_DAILY_TRADE_COUNT}")
    ui_log("BOOT", f"EXIT_MODE={settings.EXIT_MODE}")
    ui_log("BOOT", f"EXCHANGE_PRIORITY={settings.EXCHANGE_PRIORITY}")
    ui_log("BOOT", f"RUN_ON_SCHEDULE={settings.RUN_ON_SCHEDULE}")
    ui_log("BOOT", f"MANUAL_TRIGGER_PIPELINES={settings.MANUAL_TRIGGER_PIPELINES}")
    ui_log("BOOT", "-" * 60)
    ui_log("BOOT", "ENABLED EXCHANGES")

    for exchange in enabled_exchanges:
        ui_log(
            "BOOT",
            f"{exchange.EXCHANGE} | "
            f"BUY_PREPARE={exchange.BUY_PREPARE_TIME} | "
            f"SIGNAL={exchange.SIGNAL_TIME} | "
            f"EOD={exchange.EOD_RECONCILE_TIME} | "
            f"FORCED_SELL={exchange.FORCED_SELL_TIME} | "
            f"MAX_OPEN_POSITIONS={exchange.MAX_OPEN_POSITIONS} | "
            f"BUDGET_PCT={exchange.BUDGET_PCT} | "
            f"CURRENCY={exchange.CURRENCY}",
        )

    ui_log("BOOT", "-" * 60)
    ui_log("BOOT", "ACCOUNT SNAPSHOT TIMES")
    ui_log("BOOT", f"POST_EU_BUY={settings.ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME}")
    ui_log("BOOT", f"POST_EU_CLOSE={settings.ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME}")
    ui_log("BOOT", f"EOD={settings.ACCOUNT_SNAPSHOT_EOD_TIME}")

    bootstrap_result = run_bootstrap_pipeline(settings)

    ui_log("BOOTSTRAP", "=" * 60)
    ui_log("BOOTSTRAP", "BOOTSTRAP RESULT")
    ui_log("BOOTSTRAP", "=" * 60)
    ui_log("BOOTSTRAP", f"SUCCESS={bootstrap_result.SUCCESS}")
    ui_log("BOOTSTRAP", f"MESSAGE={bootstrap_result.MESSAGE}")
    ui_log("BOOTSTRAP", f"FETCHED_AT={bootstrap_result.FETCHED_AT}")
    ui_log("BOOTSTRAP", f"ACCOUNT_ID={bootstrap_result.ACCOUNT_ID}")
    ui_log("BOOTSTRAP", f"OPEN_POSITION_COUNT={bootstrap_result.OPEN_POSITION_COUNT}")
    ui_log("BOOTSTRAP", f"OPEN_SYMBOLS={bootstrap_result.OPEN_SYMBOLS}")
    ui_log("BOOTSTRAP", f"ORDER_DETAIL_ROW_COUNT={bootstrap_result.ORDER_DETAIL_ROW_COUNT}")
    ui_log("BOOTSTRAP", f"POSITION_DETAIL_ROW_COUNT={bootstrap_result.POSITION_DETAIL_ROW_COUNT}")
    ui_log("BOOTSTRAP", "=" * 60)

    if not bootstrap_result.SUCCESS:
        log_service.log(
            LogEvent(
                EVENT_TYPE="APP_BOOT",
                EVENT_STATUS="FAILED",
                MESSAGE="Application boot failed.",
                DETAILS_JSON={
                    "BOOTSTRAP_MESSAGE": bootstrap_result.MESSAGE,
                },
            )
        )
        ui_log("ERROR", f"Application boot failed | MESSAGE={bootstrap_result.MESSAGE}")
        raise SystemExit(1)

    _run_manual_pipelines(settings)

    log_service.log(
        LogEvent(
            EVENT_TYPE="APP_BOOT",
            EVENT_STATUS="SUCCESS",
            MESSAGE="Application boot completed successfully.",
            DETAILS_JSON={
                "RUN_ON_SCHEDULE": settings.RUN_ON_SCHEDULE,
                "MANUAL_TRIGGER_PIPELINES": settings.MANUAL_TRIGGER_PIPELINES,
            },
        )
    )

    if settings.RUN_ON_SCHEDULE:
        ui_log("MAIN", "Starting scheduler...")
        scheduler = SchedulerService(settings)
        scheduler.start()
    else:
        ui_log("MAIN", "RUN_ON_SCHEDULE is false. Exiting after manual/test runs.")


if __name__ == "__main__":
    main()