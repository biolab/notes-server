import React from "react";
import { useIntl } from "@/i18n";
import { useFileAnswer } from "@/context/QuizContextProvider";
import { RiDeleteBin2Line } from "react-icons/ri";

export type FileDropFunction = (event: React.DragEvent<HTMLElement>) => void;

export const FileDockQuestion = ({id, accept, ref}: {
  id: string;
  accept?: string[];
  ref?: React.RefObject<FileDropFunction | null>;
}) => {
  const {t} = useIntl();
  const {files, addFiles, removeFile} = useFileAnswer(id);

  const onFilesAdd = React.useCallback(async (newFiles: File[]) => {
    const accepted = newFiles.filter(({name}) =>
      !accept?.length
      || accept.includes("." + (name.toLocaleLowerCase().split('.').pop() || "")));
    await addFiles(accepted);
  }, [accept, addFiles]);

  const onRemoveFile = React.useCallback(async (name: string) => {
    await removeFile(name);
  }, [removeFile]);

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
      <div className="flex flex-col gap-1 my-4 border-dashed border-1 rounded p-3"
      >
        <div className="flex flex-col gap-2 mb-4">
          {files.map((f) =>
            <div key={f} className="flex items-center gap-2">
              {f}
              <RiDeleteBin2Line
                onClick={() => onRemoveFile(f)}
                style={{cursor: "pointer"}}
                className="hover:text-red-700"
              />
            </div>
        )}
        </div>
        <div className="flex items-center justify-between">
          <input
            id="file"
            type="file"
            accept={accept?.join(",")}
            multiple
            onChange={onFileChange}
            style={{display: 'none'}}/>
          <label
            htmlFor="file"
            className={`px-10 mr-4 submit-quiz-popup-button border border-black rounded cursor-pointer transition inline-block`}
          >
            {t("quiz.select-files")(files.length, true)}
          </label>

          <small className="form-text text-muted" style={{lineHeight: "1.4"}}>
            {t(`quiz.upload-desc`)(true)}
            {accept && <>
              <br/>
              {t("quiz.upload-allowed-extensions")} {accept.join(", ")}
            </>}
          </small>
        </div>
      </div>
    </>
  }
