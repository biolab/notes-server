import React from "react";
import { useIntl } from "@/i18n";
import { useLastAnswer } from "@/context/QuizContextProvider";
import { RiDeleteBin2Line } from "react-icons/ri";

export type FileDropFunction = (event: React.DragEvent<HTMLElement>) => void;

export const FileQuestion = ({id, submitDisabled, setSubmitted, accept, multiple, ref}: {
  id: string;
  submitDisabled: boolean;
  setSubmitted: (s: boolean) => void;
  accept?: string[];
  multiple?: boolean;
  ref: React.Ref<FileDropFunction>
}) => {
  const {t} = useIntl();
  const {answer, uploadFiles} = useLastAnswer(id);
  const [files, setFiles] = React.useState<File[]>([]);

  const onSubmitFiles = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitDisabled || files.length === 0) {
      return;
    }
    if (await uploadFiles(files)) {
      setSubmitted(true);
      setFiles([]);
    }
  }, [files, uploadFiles, submitDisabled, setSubmitted]);

  const onFilesAdd = React.useCallback(async (newFiles: File[]) => {
    const filtered = newFiles.filter(({name}) =>
      !accept?.length
      || accept.includes("." + (name.split('.').pop() || "")));
    if (!filtered.length) {
      return;
    }
    if (multiple) {
      const newFileNames = newFiles.map(({name}) => name);
      setFiles((prev) => [
        ...prev.filter(({name}) => !newFileNames.includes(name)),
        ...filtered]);
    }
    else {
      setFiles([filtered[0]]);
    }
  }, [multiple, accept]);

  const onRemoveFile = React.useCallback((name: string) => {
    setFiles(files.filter((f) => f.name !== name));
  }, [files]);

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
    { answer &&
      <div className="mb-4">
        { `${t("quiz.uploaded-file")} ${answer.replaceAll(":", ", ")}.` }
      </div>
    }
    { !submitDisabled &&
      <>
        { files.length > 0 &&
          <div className="flex gap-4 my-4">
            <div className="text-nowrap">
              {t("quiz.upload-staged")}
            </div>
            <div>
              <div className="flex flex-wrap gap-4 mb-4">
                {files.map((f =>
                    <div className="flex gap-1 border border-dashed rounded px-1 items-center" key={f.name}>
                      {f.name}
                      <RiDeleteBin2Line
                        onClick={() => onRemoveFile(f.name)}
                        style={{cursor: "pointer"}}
                      />
                    </div>
                ))}
              </div>
              <button onClick={onSubmitFiles}>
                {t(`quiz.upload${answer ? "-replace" : ""}-button`)}
              </button>
            </div>
          </div>
        }
        <div className="flex items-center  justify-between">
          <input id="file" type="file" multiple={multiple} onChange={onFileChange}
                 style={{display: 'none'}}/>
          <label
            htmlFor="file"
            className={`px-10 py-2 mr-4 submit-quiz-popup-button border border-black rounded cursor-pointer transition inline-block`}
          >
            {t(multiple ? "quiz.select-files" : "quiz.select-file")}
          </label>

          <small className="form-text text-muted" style={{lineHeight: "1.4"}}>
            {t(`quiz.upload-${multiple ? "multiple" : "single"}-desc`)}
            { accept && <>
              <br/>
              {t("quiz.upload-allowed-extensions")}: {accept.join(", ")}
            </> }
          </small>
        </div>
      </>
    }
  </>
}
