import React, { useCallback, useEffect, useId, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, FileText, Link2, Pencil, PlayCircle, Plus, RefreshCw, Send, Trash2, Type } from 'lucide-react';

import ContentItem from '../../components/content/ContentItem';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import { useT } from '../../i18n/LanguageContext';
import { contentErrorMessage } from '../../i18n/apiError';
import { contentService } from '../../services/contentService';
import { CONTENT_TYPES, FILE_TYPES, contentErrors, moveContent } from './teaching';
import TextEditor from './TextEditor';

/*
  A meeting's materials, for the teacher who answers for it (owner, 2026-10-04) -
  /api/content. Each item shows as students see it (ContentItem, staff: drafts
  marked) with the teacher's tools under it: publish a draft, edit, move, delete.
  "Add material" opens the form inline: a type (text, video, link, file), a title
  and what the type holds; saved as a draft, or saved and published at once. Only
  a published item reaches students; publishing cannot be undone, deleting can
  always be done. A cancelled meeting takes no new material (the server says so).
*/

const TYPE_ICON = { TEXT: Type, VIDEO: PlayCircle, LINK: Link2, FILE: FileText };
const tool =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

const emptyDraft = (type = 'TEXT') => ({ type, title: '', url: '', html: '', file: null });

const ContentForm = ({ sessionId, editing, onSaved, onCancel }) => {
  const { t } = useT();
  const baseId = useId();
  const [draft, setDraft] = useState(() =>
    editing
      ? { type: editing.type, title: editing.title, url: editing.payload?.url ?? '', html: editing.payload?.html ?? '', file: null }
      : emptyDraft()
  );
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);

  const set = (field) => (value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null, global: null }));
  };

  const save = async (publish) => {
    const found = contentErrors(draft, { editing: Boolean(editing) });
    setErrors(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, t(v)])));
    if (Object.keys(found).length) return;

    setBusy(publish ? 'publish' : 'save');
    try {
      const title = draft.title.trim();
      let saved;
      if (editing) {
        const patch = {};
        if (title !== editing.title) patch.title = title;
        if ((draft.type === 'VIDEO' || draft.type === 'LINK') && draft.url.trim() !== (editing.payload?.url ?? '')) patch.url = draft.url.trim();
        if (draft.type === 'TEXT' && draft.html !== (editing.payload?.html ?? '')) patch.html = draft.html;
        saved = Object.keys(patch).length ? await contentService.update(editing.id, patch) : editing;
      } else if (draft.type === 'FILE') {
        saved = await contentService.upload(sessionId, draft.file, title);
      } else if (draft.type === 'TEXT') {
        saved = await contentService.create(sessionId, { type: 'TEXT', title, html: draft.html });
      } else {
        saved = await contentService.create(sessionId, { type: draft.type, title, url: draft.url.trim() });
      }
      if (publish && saved && !saved.published) saved = await contentService.publish(saved.id);
      onSaved(saved, { created: !editing, published: publish });
    } catch (err) {
      setBusy(null);
      setErrors({ global: contentErrorMessage(err, t) });
    }
  };

  return (
    <div className="rounded-2xl border border-brand/30 bg-white p-4 sm:p-5 space-y-4">
      <h4 className="text-sm font-extrabold text-slate-800">{t(editing ? 'teach.content.editTitle' : 'teach.content.addTitle')}</h4>

      {!editing && (
        <div role="radiogroup" aria-label={t('teach.content.type')} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CONTENT_TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            const on = draft.type === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={Boolean(busy)}
                onClick={() => {
                  setDraft((prev) => ({ ...emptyDraft(type), title: prev.title }));
                  setErrors({});
                }}
                className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  on ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {t(`content.type.${type}`)}
              </button>
            );
          })}
        </div>
      )}

      <Input
        id={`${baseId}-title`}
        name="title"
        label={t('teach.content.titleLabel')}
        value={draft.title}
        maxLength={200}
        disabled={Boolean(busy)}
        error={errors.title || undefined}
        onChange={(e) => set('title')(e.target.value)}
      />

      {(draft.type === 'VIDEO' || draft.type === 'LINK') && (
        <div className="space-y-1">
          <Input
            id={`${baseId}-url`}
            name="url"
            type="url"
            label={t(draft.type === 'VIDEO' ? 'teach.content.videoUrl' : 'teach.content.linkUrl')}
            placeholder="https://"
            value={draft.url}
            disabled={Boolean(busy)}
            error={errors.url || undefined}
            onChange={(e) => set('url')(e.target.value)}
          />
          <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
            {t(draft.type === 'VIDEO' ? 'teach.content.videoHint' : 'teach.content.linkHint')}
          </p>
        </div>
      )}

      {draft.type === 'TEXT' && (
        <div className="space-y-1.5">
          <span id={`${baseId}-text-label`} className="block text-sm font-bold text-slate-700">
            {t('teach.content.text')}
          </span>
          <TextEditor
            id={`${baseId}-text`}
            labelledBy={`${baseId}-text-label`}
            value={draft.html}
            onChange={set('html')}
            disabled={Boolean(busy)}
            invalid={Boolean(errors.html)}
          />
          {errors.html && <p className="text-xs font-semibold text-red-600">{errors.html}</p>}
        </div>
      )}

      {draft.type === 'FILE' && !editing && (
        <div className="space-y-1.5">
          <label htmlFor={`${baseId}-file`} className="block text-sm font-bold text-slate-700">
            {t('teach.content.file')}
          </label>
          <input
            id={`${baseId}-file`}
            type="file"
            accept={FILE_TYPES.map((ext) => `.${ext}`).join(',')}
            disabled={Boolean(busy)}
            onChange={(e) => set('file')(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 file:mr-3 file:px-3.5 file:py-2 file:rounded-xl file:border-0 file:bg-brand-tint file:text-brand file:text-xs file:font-extrabold hover:file:bg-brand hover:file:text-white file:cursor-pointer"
          />
          <p className="text-[11px] font-medium text-slate-500">{t('teach.content.fileHint')}</p>
          {errors.file && <p className="text-xs font-semibold text-red-600">{errors.file}</p>}
        </div>
      )}

      {editing?.type === 'FILE' && <p className="text-[11px] font-medium text-slate-500">{t('teach.content.fileFixed')}</p>}

      {errors.global && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {errors.global}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button type="button" onClick={onCancel} disabled={Boolean(busy)} className={`${tool} justify-center text-slate-600 hover:bg-slate-100`}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={Boolean(busy)}
          className={`${tool} justify-center border border-slate-200 text-slate-700 hover:bg-slate-50`}
        >
          {busy === 'save' ? t('common.loading') : t(editing ? 'teach.content.saveChanges' : 'teach.content.saveDraft')}
        </button>
        {(!editing || !editing.published) && (
          <button type="button" onClick={() => save(true)} disabled={Boolean(busy)} className={`${tool} justify-center bg-brand text-white hover:bg-brand-deep`}>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            {busy === 'publish' ? t('common.loading') : t('teach.content.saveAndPublish')}
          </button>
        )}
      </div>
    </div>
  );
};

export const TeacherMaterials = ({ session, showToast }) => {
  const { t } = useT();
  const [list, setList] = useState(undefined);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState(null); // null | 'new' | content being edited
  const [deleting, setDeleting] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [working, setWorking] = useState(false);
  const cancelled = session.status !== 'SCHEDULED';

  useEffect(() => {
    let stop = false;
    contentService
      .listForSession(session.id)
      .then((answer) => {
        if (stop) return;
        setList(answer?.contents ?? []);
        setError(null);
      })
      .catch((err) => !stop && setError(contentErrorMessage(err, t)));
    return () => {
      stop = true;
    };
  }, [session.id, attempt, t]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const fail = (err) => {
    showToast?.(contentErrorMessage(err, t), 'error');
    reload();
  };

  const onSaved = (saved, { created, published }) => {
    setForm(null);
    showToast?.(t(published ? 'teach.content.publishedToast' : created ? 'teach.content.draftToast' : 'teach.content.savedToast', { title: saved?.title ?? '' }), 'success');
    reload();
  };

  const publish = async () => {
    setWorking(true);
    try {
      await contentService.publish(publishing.id);
      showToast?.(t('teach.content.publishedToast', { title: publishing.title }), 'success');
      setPublishing(null);
      reload();
    } catch (err) {
      setPublishing(null);
      fail(err);
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    setWorking(true);
    try {
      await contentService.remove(deleting.id);
      showToast?.(t('teach.content.deletedToast', { title: deleting.title }), 'success');
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleting(null);
      fail(err);
    } finally {
      setWorking(false);
    }
  };

  const move = async (id, step) => {
    const ids = list.map((item) => item.id);
    const next = moveContent(ids, id, step);
    if (next.join() === ids.join()) return;
    const byId = new Map(list.map((item) => [item.id, item]));
    setList(next.map((nextId) => byId.get(nextId)));
    try {
      await contentService.reorder(session.id, next);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby={`materials-${session.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`materials-${session.id}`} className="text-base font-extrabold text-slate-800">
          {t('classroom.materials')}
        </h3>
        {!form && !cancelled && list !== undefined && !error && (
          <button type="button" onClick={() => setForm('new')} className={`${tool} bg-brand-tint text-brand hover:bg-brand hover:text-white`}>
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {t('teach.content.add')}
          </button>
        )}
      </div>

      {cancelled && <p className="text-xs font-semibold text-slate-500">{t('teach.content.cancelledMeeting')}</p>}

      {form === 'new' && <ContentForm sessionId={session.id} onSaved={onSaved} onCancel={() => setForm(null)} />}

      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button type="button" onClick={reload} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      ) : list === undefined ? (
        <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" aria-label={t('common.loading')} />
      ) : list.length === 0 && form !== 'new' ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 px-6 text-center">
          <BookOpen className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-sm font-extrabold text-slate-600">{t('teach.content.none')}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((item, index) =>
            form && form !== 'new' && form.id === item.id ? (
              <li key={item.id}>
                <ContentForm sessionId={session.id} editing={item} onSaved={onSaved} onCancel={() => setForm(null)} />
              </li>
            ) : (
              <ContentItem
                key={item.id}
                item={item}
                staff
                onFileError={(message) => showToast?.(message, 'error')}
                actions={
                  <>
                    {!item.published && (
                      <button type="button" onClick={() => setPublishing(item)} className={`${tool} bg-brand text-white hover:bg-brand-deep`}>
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        {t('teach.content.publish')}
                      </button>
                    )}
                    <button type="button" onClick={() => setForm(item)} disabled={Boolean(form)} className={`${tool} text-slate-700 hover:bg-slate-100`}>
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('teach.content.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item.id, -1)}
                      disabled={index === 0}
                      aria-label={t('teach.content.moveUp', { title: item.title })}
                      className={`${tool} text-slate-600 hover:bg-slate-100`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item.id, 1)}
                      disabled={index === list.length - 1}
                      aria-label={t('teach.content.moveDown', { title: item.title })}
                      className={`${tool} text-slate-600 hover:bg-slate-100`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDeleting(item)} className={`${tool} ml-auto text-rose-700 hover:bg-rose-50`}>
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('teach.content.delete')}
                    </button>
                  </>
                }
              />
            )
          )}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(publishing)}
        tone="brand"
        icon={Send}
        title={t('teach.content.publishTitle')}
        body={publishing ? t('teach.content.publishBody', { title: publishing.title }) : ''}
        confirmLabel={t('teach.content.publish')}
        cancelLabel={t('common.cancel')}
        busy={working}
        onConfirm={publish}
        onCancel={() => setPublishing(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={t('teach.content.deleteTitle')}
        body={deleting ? t(deleting.published ? 'teach.content.deleteBodyPublished' : 'teach.content.deleteBody', { title: deleting.title }) : ''}
        confirmLabel={t('teach.content.delete')}
        cancelLabel={t('common.cancel')}
        busy={working}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
};

export default TeacherMaterials;
