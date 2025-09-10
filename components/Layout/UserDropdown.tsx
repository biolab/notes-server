"use client";

import React from "react";
import { BiUserCircle } from "react-icons/bi";
import { Modal } from "antd";
import { UserContext } from "@/context/UserContextProvider";
import { deleteUser } from "@/api/UserService";
import { logger } from "@/utils/logger";
import { toast } from "react-toastify";

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

const UserDropdown = ({showLinkToResults=false, returnLink, onChangeShowAnswers}: {
  showLinkToResults?: boolean;
  returnLink?: string;
  isAdmin?: boolean
  onChangeShowAnswers?: (show: boolean) => void;
}) => {
  const { user, logOut } = React.useContext(UserContext);

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
      toast.error("Something went wrong. User data was not deleted.");
    }

    setConfirmLoading(false);
  }, [logOut, user]);

  const handleShowModal = React.useCallback(() => {
    setShowModal(true);
    setShow(false);
  }, []);

  if (!user) {
    return null;
  }

  const toResults = () =>
    { window.location.assign("?results"); }
  const toPage = () =>
    { window.location.assign(window.location.origin + window.location.pathname); }
  const toLogin = () =>
    { window.location.assign("/login"); }
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
                <li className="dropdown-content-data">{user.email}</li>
                {showLinkToResults && <li onClick={toResults}>Show Quiz Results</li>}
                {returnLink && <li onClick={toPage}>Back to {returnLink}</li>}
                {onChangeShowAnswers &&
                  <li style={{textWrap: "nowrap"}}>
                    <input
                      type="checkbox" id="showAnwers"
                      checked={showUsersAnswers}
                      onChange={changeShowUsersAnswers}
                    />
                    <label htmlFor="showAnwers">
                      &nbsp;Show Users&apos; Answers
                    </label>
                  </li>
                }
                <li onClick={toLogout}>Log out</li>
                <li onClick={handleShowModal}
                    title="Delete your account and all related data"
                    className="danger">
                  Delete account
                </li>
              </>
             : <>
                <li className="dropdown-content-data">Anonymous user</li>
                <li onClick={toLogin}>Log in</li>
                <li onClick={toLogout}
                    title={"Remove question answers, group memberships and tokens."}>
                  Reset page
                </li>
              </>
            }
          </ul>
        }
    </div>

    <Modal
      title="Delete user data"
      open={showModal}
      onOk={handleClose}
      confirmLoading={confirmLoading}
      onCancel={() => setShowModal(false)}
    >
      <p>
        This action is irreversible. Once confirmed, all account data will be
        permanently erased from our system. There is no way to recover this
        data after deletion. Please proceed only if you are certain.
      </p>
    </Modal>
  </>
};

export default UserDropdown;
