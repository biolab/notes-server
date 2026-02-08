"use client";

import React from "react";
import { BiUserCircle } from "react-icons/bi";
import { toast } from "react-toastify";
import { Modal } from "antd";

import { deleteUser } from "@/api/user";
import { logger } from "@/utils/logger";
import { getRealAccessToken, stopImpersonatingUser, UserContext } from "@/context/UserContextProvider";
import { useIntl } from "@/i18n";


function useOutsideClick(ref: any, onClick: any) {
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClick();
      }
    }

    document.addEventListener("mousedown", handleClickOutside, {
      passive: true,
    });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClick, ref]);
}

const UserDropdown = (
  {showLinkToResults=false, returnLink, onChangeGroup, onChangeShowAnswers}: {
  showLinkToResults?: boolean;
  returnLink?: string;
  isAdmin?: boolean;
  onChangeGroup?: () => void;
  onChangeShowAnswers?: (show: boolean) => void;
}) => {
  const { user, logOut } = React.useContext(UserContext);
  const { t } = useIntl();

  const wrapperRef = React.useRef(null);
  useOutsideClick(wrapperRef, () => setShow(false));

  const [show, setShow] = React.useState(false);
  const [showUsersAnswers, setShowUsersAnswers] = React.useState(false);

  const [showModal, setShowModal] = React.useState(false);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const handleClose = React.useCallback(async () => {
    setConfirmLoading(true);
    try {
      await deleteUser(user!.accessToken);
      logOut();
      window.location.reload();
    } catch (error) {
      logger("Error deleting user data:", error);
      toast.error(t("user.remove-data-fail"));
    }

    setConfirmLoading(false);
  }, [t, logOut, user]);

  const handleShowModal = React.useCallback(() => {
    setShowModal(true);
    setShow(false);
  }, []);

  if (!user) {
    return null;
  }
  const realAccessToken = getRealAccessToken();

  const toResults = () =>
    { window.location.assign("?results"); }
  const toPage = () =>
    { window.location.assign(window.location.origin + window.location.pathname); }
  const toLogin = () =>
    { const currentPath = encodeURIComponent(window.location.pathname);
      window.location.assign(`/login?redirect=${currentPath}`);
    }
  const toImpersonate = () => {
    window.location.assign("/login/impersonate");
  }
  const toStopImpersonation = () => {
    stopImpersonatingUser();
    window.location.reload();
  }
  const toLogout = () =>
    { logOut(); window.location.reload(); }
  const changeShowUsersAnswers = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowUsersAnswers(e.target.checked);
    onChangeShowAnswers?.(e.target.checked);
  }

  return <>
    <div ref={wrapperRef} className="user-dropdown">
      <BiUserCircle onClick={() => setShow((show) => !show)} />
        { show &&
          <ul className="dropdown-content">
            { user.email ?
              <>
                {showLinkToResults &&
                  <li onClick={toResults}>
                    { t("user.show-quiz-results") }
                  </li>}
                {returnLink &&
                  <li onClick={toPage}>
                    {t("user.back-to")} {returnLink}
                  </li>}
                {onChangeShowAnswers &&
                  <li style={{textWrap: "nowrap"}}>
                    <input
                      type="checkbox" id="showAnswers"
                      checked={showUsersAnswers}
                      onChange={changeShowUsersAnswers}
                    />
                    <label htmlFor="showAnswers">
                      &nbsp;{ t("user.show-answers") }
                    </label>
                  </li>
                }
                { onChangeGroup &&
                  <li onClick={onChangeGroup}>
                    { t("user.change-group") }
                  </li>
                }
                { user.admin &&
                  <li onClick={toImpersonate}>
                    { t("user.impersonate") }
                  </li>
                }
                { realAccessToken &&
                  <li onClick={toStopImpersonation}>
                    { t("user.stop-impersonation") }
                  </li>
                }
                <li onClick={toLogout}>
                  { t("user.log-out") }
                </li>
                <li onClick={handleShowModal}
                    title={t("user.delete-account-tooltip")}
                    className="danger">
                  { t("user.delete-account") }
                </li>
              </>
             : <>
                <li onClick={toLogin}>
                  { t("login") }
                </li>
                <li onClick={toLogout}
                    title={t("user.reset-page-tooltip")}>
                  { t("user.reset-page") }
                </li>
              </>
            }
          </ul>
        }
    </div>

    <Modal
      title={t("user.delete-account-confirm-title")}
      open={showModal}
      onOk={handleClose}
      confirmLoading={confirmLoading}
      onCancel={() => setShowModal(false)}
    >
      <p>
        { t("user.delete-account-confirm-text") }
      </p>
    </Modal>
  </>
};

export default UserDropdown;
