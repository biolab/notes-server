"use client";

import React from "react";
import { BiUserCircle } from "react-icons/bi";
import { Modal, notification } from "antd";
import { UserContext } from "@/context/UserContextProvider";
import { UserService_Delete } from "@/api/UserService";
import { logger } from "@/utils/logger";

function useOutsideClick(ref, onClick) {
  React.useEffect(() => {
    function handleClickOutside() {
      if (ref.current && !ref.current.contains(event.target)) {
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

const UserDropdown = () => {
  const { user, logOut } = React.useContext(UserContext);

  const wrapperRef = React.useRef(null);
  useOutsideClick(wrapperRef, () => setShow(false));

  const [show, setShow] = React.useState(false);

  const [api, contextHolder] = notification.useNotification();

  const openNotification = React.useCallback(() => {
    api.error({
      message: "Something went wrong",
      description: "User data was not deleted",
      duration: 0,
    });
  }, [api]);

  const [showModal, setShowModal] = React.useState(false);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const handleClose = React.useCallback(async () => {
    setConfirmLoading(true);
    try {
      await UserService_Delete({
        accessToken: user?.accessToken,
      });
      logOut();
      window.location.reload();
    } catch (error) {
      logger("Error deleting user data:", error);
      openNotification();
    }

    setConfirmLoading(false);
  }, [logOut, openNotification, user?.accessToken]);

  const handleShowModal = React.useCallback(() => {
    setShowModal(true);
    setShow(false);
  }, []);

  if (!user) {
    return null;
  }
  return (
    <>
      {contextHolder}
      <div ref={wrapperRef} className="user-dropdown">
        <BiUserCircle onClick={() => setShow((show) => !show)} />
        {show && (
          <ul className="dropdown-content">
            <li className="dropdown-content-data">
              {user.email || "Anonymous user"}
            </li>
            <li className="danger" onClick={handleShowModal}>
              Delete user data
            </li>
            <li
              onClick={() => {
                logOut();
                window.location.reload();
              }}
            >
              Log out
            </li>
          </ul>
        )}
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
  );
};

export default UserDropdown;
