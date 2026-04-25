from __future__ import annotations

# from ui_connection.ui_api.test_manual_api import router as test_manual_router

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ui_connection.runtime.runtime_manager import runtime_manager
from ui_connection.ui_service.contact_form_service import (
    ContactFormError,
    get_contact_subject_options,
    submit_contact_form,
)
from ui_connection.ui_service.focus_companies_service import (
    FocusCompaniesError,
    get_focus_companies_data,
    save_focus_companies,
)
from ui_connection.ui_service.login_service import (
    LoginError,
    login_user,
)
from ui_connection.ui_service.notification_service import (
    NotificationError,
    delete_admin_notification,
    delete_notification_for_user,
    dismiss_user_popup,
    get_admin_notification_detail,
    get_admin_notifications,
    get_pending_popup,
    get_user_notification_badge,
    get_user_notifications,
    read_user_notification,
    send_notification,
    unread_user_notification,
)
from ui_connection.ui_service.orders_service import (
    OrdersOverviewError,
    get_orders_overview,
)
from ui_connection.ui_service.password_reset_service import (
    PasswordResetError,
    confirm_password_reset,
    request_password_reset,
)
from ui_connection.ui_service.registration_service import (
    RegistrationError,
    register_user,
)
from ui_connection.ui_service.trade_config_service import (
    TradeConfigError,
    get_trade_configurations,
    reset_trade_configurations_to_default,
    save_trade_configurations,
)
from ui_connection.ui_service.ui_users_service import (
    UIUsersError,
    get_visible_usernames,
)
from ui_connection.ui_service.user_panel_service import (
    UserPanelError,
    delete_user_account,
    get_user_panel_data,
    update_user_panel_data,
)
from ui_connection.ui_service.wallet_overview_service import (
    WalletOverviewError,
    get_wallet_overview,
)

from ui_connection.ui_service.simulator_service import (
    SimulatorError,
    get_simulator_wallet_overview,
    update_and_get_simulator_wallet_overview,
)

from ui_connection.ui_service.simulator_params_service import (
    SimulatorParamsError,
    get_simulator_params,
    save_simulator_params,
)

from ui_connection.ui_service.sim_buy_ui_service import (
    SimBuyError,
    get_buy_signals,
    run_sim_buy,
)

class SimulatorParamsSaveRequest(BaseModel):
    params: dict

class SimExecuteBuyRequest(BaseModel):
    symbol: str
    exchange: str
    exit_type: str
    qty: int = 1
    username: str = ""
    target_price: float | None = None
    stop_price: float | None = None
    limit_price: float | None = None
    trigger_price: float | None = None
    trail_amount: float | None = None
    trailing_percent: float | None = None

class NotificationTargetRequest(BaseModel):
    target_type: str
    target_value: str | None = None


class NotificationSendRequest(BaseModel):
    title: str
    message: str
    created_by: str
    targets: list[NotificationTargetRequest]
    attachment_name: str | None = None
    attachment_path: str | None = None


class NotificationUserActionRequest(BaseModel):
    user_notification_id: int


class FocusCompaniesRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None


class FocusCompaniesSaveRequest(BaseModel):
    changes: list[dict]


class UserPanelUpdateRequest(BaseModel):
    username: str
    email: str
    first_name: str
    last_name: str
    date_of_birth: str
    mobile_phone: str
    password: str = ""
    password_repeat: str = ""
    app_lock_password: str = ""


class UserPanelDeleteRequest(BaseModel):
    username: str
    password: str


class AppUnlockRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    emailRepeat: str
    firstName: str
    lastName: str
    dateOfBirth: str
    country: str
    mobilePhone: str
    gender: str
    experience: str
    estimatedBudget: str
    password: str
    passwordRepeat: str
    responsibilityApproved: bool
    language: str


class LoginRequest(BaseModel):
    email: str
    password: str
    responsibilityApproved: bool
    language: str


class ForgotPasswordRequest(BaseModel):
    email: str
    language: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    passwordRepeat: str
    language: str


class TradeConfigRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None


class TradeConfigSaveRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None
    sections: list


class ContactFormRequest(BaseModel):
    username: str | None = None
    email: str
    first_name: str | None = None
    last_name: str | None = None
    mobile_phone: str | None = None
    subject: str
    message: str
    language: str | None = None

class SimulatorWalletRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None

class SimulatorWalletRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None
    language: str | None = "en"

app = FastAPI(title="TradeOPS UI API")
# app.include_router(test_manual_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/register")
def register(request: RegisterRequest):
    try:
        return register_user(request.model_dump())
    except RegistrationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.post("/api/login")
def login(request: LoginRequest):
    try:
        return login_user(request.model_dump())
    except LoginError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
                "redirect_to": exc.redirect_to,
                "warning": exc.warning,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.post("/api/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    try:
        return request_password_reset(request.model_dump())
    except PasswordResetError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.post("/api/reset-password")
def reset_password(request: ResetPasswordRequest):
    try:
        return confirm_password_reset(request.model_dump())
    except PasswordResetError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.get("/api/runtime/status")
def runtime_status():
    return runtime_manager.get_status()


@app.get("/api/runtime/logs")
def runtime_logs(limit: int = 400):
    return {"logs": runtime_manager.get_logs(limit)}


@app.post("/api/runtime/tws/start")
def runtime_tws_start():
    try:
        return runtime_manager.start_tws()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"TWS start failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/tws/stop")
def runtime_tws_stop():
    try:
        return runtime_manager.stop_tws()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"TWS stop failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/tws/restart")
def runtime_tws_restart():
    try:
        return runtime_manager.restart_tws()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"TWS restart failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/server/start")
def runtime_server_start():
    try:
        return runtime_manager.start_server()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Server start failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/server/stop")
def runtime_server_stop():
    try:
        return runtime_manager.stop_server()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Server stop failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/server/restart")
def runtime_server_restart():
    try:
        return runtime_manager.restart_server()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Server restart failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/test")
def runtime_test():
    try:
        return runtime_manager.runtime_test()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Runtime test failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/stop-all")
def runtime_stop_all():
    try:
        return runtime_manager.stop_all()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Stop-all failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/logs/clear")
def runtime_logs_clear():
    try:
        return runtime_manager.clear_logs()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Log clear failed: {str(exc)}"},
        ) from exc


@app.get("/api/wallet-overview")
def wallet_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
    ibkr_mode: str = "LIVE",
    chart_days: int = 30,
):
    try:
        return get_wallet_overview(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
            selected_username=selected_username,
            ibkr_mode=ibkr_mode,
            chart_days=chart_days,
        )
    except WalletOverviewError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Wallet overview failed: {str(exc)}"},
        ) from exc


@app.get("/api/ui/users")
def ui_users(requesting_username: str, requesting_user_type: str):
    try:
        return get_visible_usernames(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
        )
    except UIUsersError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"User list failed: {str(exc)}"},
        ) from exc


@app.get("/api/orders-overview")
def orders_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
    ibkr_mode: str = "LIVE",
):
    try:
        return get_orders_overview(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
            selected_username=selected_username,
            ibkr_mode=ibkr_mode,
        )
    except OrdersOverviewError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Orders overview failed: {str(exc)}"},
        ) from exc


@app.get("/api/trade-configurations")
def trade_configurations(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
):
    try:
        return get_trade_configurations(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
            selected_username=selected_username,
        )
    except TradeConfigError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Trade configurations failed: {str(exc)}"},
        ) from exc


@app.post("/api/trade-configurations/save")
def trade_configurations_save(request: TradeConfigSaveRequest):
    try:
        return save_trade_configurations(
            requesting_username=request.requesting_username,
            requesting_user_type=request.requesting_user_type,
            selected_username=request.selected_username,
            payload={"sections": request.sections},
        )
    except TradeConfigError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Trade configuration save failed: {str(exc)}"},
        ) from exc


@app.post("/api/trade-configurations/reset-defaults")
def trade_configurations_reset(request: TradeConfigRequest):
    try:
        return reset_trade_configurations_to_default(
            requesting_username=request.requesting_username,
            requesting_user_type=request.requesting_user_type,
            selected_username=request.selected_username,
        )
    except TradeConfigError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Trade configuration reset failed: {str(exc)}"},
        ) from exc


@app.get("/api/user-panel")
def user_panel(username: str):
    try:
        return get_user_panel_data(username)
    except UserPanelError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"User panel failed: {str(exc)}"},
        ) from exc


@app.post("/api/user-panel/update")
def user_panel_update(current_username: str, request: UserPanelUpdateRequest):
    try:
        return update_user_panel_data(current_username, request.model_dump())
    except UserPanelError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"User update failed: {str(exc)}"},
        ) from exc


@app.post("/api/user-panel/delete")
def user_panel_delete(request: UserPanelDeleteRequest):
    try:
        return delete_user_account(request.username, request.password)
    except UserPanelError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"User delete failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/unlock")
def runtime_unlock(request: AppUnlockRequest):
    try:
        from ui_connection.ui_repository.user_panel_repository import get_registered_user_by_username

        user = get_registered_user_by_username(request.username)
        if not user:
            return {"success": False}

        stored = (user.get("APP_LOCK_PASSWORD") or "").strip()
        return {"success": stored == request.password.strip()}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Unlock failed: {str(exc)}"},
        ) from exc


@app.get("/api/contact-form/subjects")
def contact_form_subjects():
    return {"subjects": get_contact_subject_options()}


@app.post("/api/contact-form/submit")
def contact_form_submit(request: ContactFormRequest):
    try:
        return submit_contact_form(request.model_dump())
    except ContactFormError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Contact form submit failed: {str(exc)}"},
        ) from exc


@app.post("/api/focus-companies")
def focus_companies(request: FocusCompaniesRequest):
    try:
        return get_focus_companies_data(
            requesting_username=request.requesting_username,
            requesting_user_type=request.requesting_user_type,
            selected_username=request.selected_username,
        )
    except FocusCompaniesError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Focus companies failed: {str(exc)}"},
        ) from exc


@app.post("/api/focus-companies/save")
def focus_companies_save(request: FocusCompaniesSaveRequest):
    try:
        return save_focus_companies(request.changes)
    except FocusCompaniesError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Focus companies save failed: {str(exc)}"},
        ) from exc


@app.post("/api/notifications/send")
def notifications_send(request: NotificationSendRequest):
    try:
        return send_notification(request.model_dump())
    except NotificationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Notification send failed: {str(exc)}"},
        ) from exc


@app.get("/api/admin/notifications")
def admin_notifications():
    try:
        return get_admin_notifications()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Admin notifications failed: {str(exc)}"},
        ) from exc


@app.get("/api/admin/notifications/detail")
def admin_notifications_detail(notification_id: int = Query(...)):
    try:
        return get_admin_notification_detail(notification_id)
    except NotificationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Admin notification detail failed: {str(exc)}"},
        ) from exc


@app.post("/api/admin/notifications/delete")
def admin_notifications_delete(request: NotificationUserActionRequest):
    try:
        return delete_admin_notification(request.user_notification_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Delete notification failed: {str(exc)}"},
        ) from exc


@app.get("/api/user/notifications")
def user_notifications(username: str):
    try:
        return get_user_notifications(username)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"User notifications failed: {str(exc)}"},
        ) from exc


@app.get("/api/user/notifications/badge")
def user_notifications_badge(username: str):
    try:
        return get_user_notification_badge(username)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Notification badge failed: {str(exc)}"},
        ) from exc


@app.get("/api/user/notifications/pending-popup")
def user_notifications_pending_popup(username: str):
    try:
        return get_pending_popup(username)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Pending popup failed: {str(exc)}"},
        ) from exc


@app.post("/api/user/notifications/dismiss-popup")
def user_notifications_dismiss_popup(request: NotificationUserActionRequest):
    try:
        return dismiss_user_popup(request.user_notification_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Dismiss popup failed: {str(exc)}"},
        ) from exc


@app.post("/api/user/notifications/read")
def user_notifications_read(request: NotificationUserActionRequest):
    try:
        return read_user_notification(request.user_notification_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Read notification failed: {str(exc)}"},
        ) from exc


@app.post("/api/user/notifications/unread")
def user_notifications_unread(request: NotificationUserActionRequest):
    try:
        return unread_user_notification(request.user_notification_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Unread notification failed: {str(exc)}"},
        ) from exc


@app.post("/api/user/notifications/delete")
def user_notifications_delete(request: NotificationUserActionRequest):
    try:
        return delete_notification_for_user(request.user_notification_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Delete notification failed: {str(exc)}"},
        ) from exc
    
@app.post("/api/simulator/wallet-overview")
def simulator_wallet_overview(request: SimulatorWalletRequest):
    try:
        return get_simulator_wallet_overview(
            requesting_username=request.requesting_username,
            requesting_user_type=request.requesting_user_type,
            selected_username=request.selected_username,
        )
    except SimulatorError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Simulator wallet overview failed: {str(exc)}"},
        ) from exc


@app.post("/api/simulator/wallet-overview/update")
def simulator_wallet_overview_update(request: SimulatorWalletRequest):
    try:
        return update_and_get_simulator_wallet_overview(
        requesting_username=request.requesting_username,
        requesting_user_type=request.requesting_user_type,
        selected_username=request.selected_username,
        language=request.language or "en",
    )
    except SimulatorError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Simulator wallet update failed: {str(exc)}"},
        ) from exc
    
@app.get("/api/simulator/parameters")
def simulator_parameters():
    try:
        return get_simulator_params()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Simulator parameters failed: {str(exc)}"},
        ) from exc


@app.post("/api/simulator/parameters/save")
def simulator_parameters_save(request: SimulatorParamsSaveRequest):
    try:
        return save_simulator_params(request.model_dump())
    except SimulatorParamsError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Simulator parameters save failed: {str(exc)}"},
        ) from exc


@app.get("/api/simulator/available-funds")
def simulator_available_funds(username: str):
    try:
        from ui_connection.ui_repository.simulator_repository import fetch_sim_available_funds
        return fetch_sim_available_funds(username)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Available funds failed: {str(exc)}"},
        ) from exc


@app.get("/api/simulator/buy-signals")
def simulator_buy_signals():
    try:
        return get_buy_signals()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Buy signals failed: {str(exc)}"},
        ) from exc


@app.post("/api/simulator/execute-buy")
def simulator_execute_buy(request: SimExecuteBuyRequest):
    try:
        return run_sim_buy(request.model_dump())
    except SimBuyError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Execute buy failed: {str(exc)}"},
        ) from exc