import { startTransition, type FormEvent } from "react";

/**
 * React 19 eylem bitince formu sıfırlar; hata dönünce girilen tartım ve tahsisler kaybolmasın diye gönderimi elle başlatırız.
 * JavaScript yoksa form yine action ile gider (aşamalı geliştirme). `check` false dönerse gönderim yapılmaz.
 */
export const keepValues =
  (dispatch: (fd: FormData) => void, check?: (fd: FormData) => boolean) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    if (check && !check(fd)) return;
    startTransition(() => dispatch(fd));
  };
