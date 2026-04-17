"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import type { VocabularyRecord } from "@/types/models";

type VocabularyPanelProps = {
  items: VocabularyRecord[];
  wordDraft: string;
  onWordDraftChange: (value: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  feedback?: string;
  canSave: boolean;
};

export const VocabularyPanel = memo(function VocabularyPanel({
  items,
  wordDraft,
  onWordDraftChange,
  onSave,
  onDelete,
  feedback,
  canSave,
}: VocabularyPanelProps): JSX.Element {
  const t = useTranslations("PracticeClient");

  return (
    <section className="vocabulary-panel">
      <div className="vocabulary-panel-header">
        <div>
          <h3 className="segment-title">{t("vocabularyTitle")}</h3>
          <p className="muted vocabulary-subtitle">{t("vocabularyHint")}</p>
        </div>
        <span className="progress-pct">{t("vocabularyCount", { count: items.length })}</span>
      </div>

      <div className="vocabulary-input-row">
        <input
          type="text"
          value={wordDraft}
          onChange={(event) => onWordDraftChange(event.target.value)}
          placeholder={t("vocabularyPlaceholder")}
          aria-label={t("vocabularyInputLabel")}
        />
        <button type="button" className="btn secondary" disabled={!canSave} onClick={onSave}>
          {t("saveWord")}
        </button>
      </div>

      {feedback ? <p className="vocabulary-feedback">{feedback}</p> : null}

      {items.length === 0 ? (
        <p className="muted">{t("vocabularyEmpty")}</p>
      ) : (
        <div className="vocabulary-list" role="list" aria-label={t("vocabularyListLabel")}>
          {items.map((item) => (
            <div key={item.id} className="vocabulary-item" role="listitem">
              <div className="vocabulary-item-main">
                <p className="vocabulary-word">{item.word}</p>
                {item.segmentIndex !== undefined ? (
                  <p className="muted vocabulary-meta">
                    {t("wordSource", { number: item.segmentIndex + 1 })}
                  </p>
                ) : null}
                {item.segmentText ? <p className="vocabulary-context">{item.segmentText}</p> : null}
              </div>
              <button type="button" className="text-btn" onClick={() => onDelete(item.id)}>
                {t("deleteWord")}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
