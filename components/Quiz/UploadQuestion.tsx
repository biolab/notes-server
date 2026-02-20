import React from "react";
import { useIntl } from "@/i18n";
import { useFileAnswer } from "@/context/QuizContextProvider";
import { RiDeleteBin2Line } from "react-icons/ri";

export type FileDropFunction = (event: React.DragEvent<HTMLElement>) => void;

export const FileQuestion = ({id, accept, multiple, ref}: {
  id: string;
  accept?: string[];
  multiple?: boolean;
  ref?: React.RefObject<FileDropFunction | null>;
}) => {
  const {t} = useIntl();
  const {files: uploadedFiles, addFiles} = useFileAnswer(id);
  const [preparedFiles, setPreparedFiles] = React.useState<File[]>([]);
  const submitDisabled = React.useMemo(() => uploadedFiles?.length !== 0, [uploadedFiles]);

  const onSubmitFiles = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitDisabled || preparedFiles.length === 0) {
      return;
    }
    if (await addFiles(preparedFiles)) {
      setPreparedFiles([]);
    }
  }, [submitDisabled, preparedFiles, addFiles]);

  const onFilesAdd = React.useCallback(async (newFiles: File[]) => {
    const filtered = newFiles.filter(({name}) =>
      !accept?.length
      || accept.includes("." + (name.toLocaleLowerCase().split('.').pop() || "")));
    if (!filtered.length) {
      return;
    }
    if (multiple) {
      const newFileNames = newFiles.map(({name}) => name);
      setPreparedFiles((prev) => [
        ...prev.filter(({name}) => !newFileNames.includes(name)),
        ...filtered]);
    }
    else {
      setPreparedFiles([filtered[0]]);
    }
  }, [multiple, accept]);

  const onRemoveFile = React.useCallback((name: string) => {
    setPreparedFiles(preparedFiles.filter((f) => f.name !== name));
  }, [preparedFiles]);

  const onFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        await onFilesAdd([...event.target.files]);
      }
    },
    [onFilesAdd]
  );

  const onFileDrop = React.useCallback(async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    await onFilesAdd(
      [...event.dataTransfer.items]
        .map((item: DataTransferItem) => item.getAsFile())
        .filter((item) => item !== null));
  }, [onFilesAdd]);

  React.useImperativeHandle(ref, () => onFileDrop, [onFileDrop]);

  return <>
    { !!uploadedFiles.length &&
      <div className="mb-4">
        { `${t("quiz.uploaded-file")} ${uploadedFiles.join(", ")}.` }
      </div>
    }
    { !submitDisabled &&
      <>
        <div className="flex flex-col gap-1 my-4 border-dashed border-1 rounded p-3"
        >
          <div className="grid gap-x-5 px-1 mb-3 items-center"
               style={{gridTemplateColumns: "max-content auto"}}>
            {preparedFiles.map((f) =>
              <React.Fragment key={f.name}>
                {f.name}
                <RiDeleteBin2Line
                  onClick={() => onRemoveFile(f.name)}
                  style={{cursor: "pointer"}}
                  className="hover:text-red-700"
                />
              </React.Fragment>
          )}
          </div>
          <div className="flex items-center  justify-between">
            <label
              className={`px-10 mr-4 submit-quiz-popup-button border border-black rounded cursor-pointer transition inline-block`}
            >
              <input
                type="file"
                multiple={multiple}
                accept={accept?.join(",")}
                onChange={onFileChange}
                style={{display: 'none'}}
              />
              {t("quiz.select-files")(preparedFiles.length, multiple)}
            </label>

            <small className="form-text text-muted" style={{lineHeight: "1.4"}}>
              {t(`quiz.upload-desc`)(multiple)}
              {accept && <>
                <br/>
                {t("quiz.upload-allowed-extensions")} {accept.join(", ")}
              </>}
            </small>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={onSubmitFiles} disabled={!preparedFiles.length}>
            {t(`quiz.submit-button`)}
          </button>
          { !!preparedFiles.length &&
            <div className="flex flex-col" style={{lineHeight: "1.4"}}>
              <small className="form-text text-red-500">
                { t("quiz.dont-forget-to-submit-file")(preparedFiles.length) }
              </small>
            </div>
          }
        </div>
      </>
      }
    </>
  }
