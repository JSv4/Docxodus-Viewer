import { useState, useMemo } from 'react';
import type { Revision } from 'docxodus/react';
import { isInsertion, isDeletion, isMove, isFormatChange } from 'docxodus';

interface RevisionPanelProps {
  revisions: Revision[];
}

type FilterType = 'all' | 'insertions' | 'deletions' | 'moves' | 'formatting';

function getRevisionTypeLabel(revision: Revision): string {
  if (isInsertion(revision)) return 'Inserted';
  if (isDeletion(revision)) return 'Deleted';
  if (isMove(revision)) return revision.isMoveSource ? 'Moved from' : 'Moved to';
  if (isFormatChange(revision)) return 'Formatted';
  return String(revision.revisionType);
}

function getRevisionTypeClass(revision: Revision): string {
  if (isInsertion(revision)) return 'rdv-revision--insertion';
  if (isDeletion(revision)) return 'rdv-revision--deletion';
  if (isMove(revision)) return 'rdv-revision--move';
  if (isFormatChange(revision)) return 'rdv-revision--format';
  return '';
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Filter out raw XML values and clean up property names
function isValidPropertyValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Filter out raw XML data
  if (value.includes('<') || value.includes('xmlns') || value.includes('Unid=')) return false;
  // Filter out overly long values (likely XML)
  if (value.length > 100) return false;
  return true;
}

// Make property names more readable
function formatPropertyName(name: string): string {
  // Convert camelCase to Title Case with spaces
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Format property value for display
function formatPropertyValue(value: string): string {
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  if (value === 'single') return 'Single';
  if (value === 'double') return 'Double';
  return value;
}

interface FormatChangeItem {
  property: string;
  oldValue?: string;
  newValue?: string;
}

// Get paired format changes (old → new for same property)
function getFormatChanges(revision: Revision): FormatChangeItem[] {
  if (!revision.formatChange) return [];

  const { oldProperties, newProperties } = revision.formatChange;
  const changes: FormatChangeItem[] = [];
  const processedKeys = new Set<string>();

  // Process old properties
  if (oldProperties) {
    for (const [key, value] of Object.entries(oldProperties)) {
      if (!isValidPropertyValue(value)) continue;
      processedKeys.add(key);
      const newValue = newProperties?.[key];
      changes.push({
        property: formatPropertyName(key),
        oldValue: formatPropertyValue(value),
        newValue: newValue && isValidPropertyValue(newValue) ? formatPropertyValue(newValue) : undefined,
      });
    }
  }

  // Process new properties not in old
  if (newProperties) {
    for (const [key, value] of Object.entries(newProperties)) {
      if (processedKeys.has(key)) continue;
      if (!isValidPropertyValue(value)) continue;
      changes.push({
        property: formatPropertyName(key),
        oldValue: undefined,
        newValue: formatPropertyValue(value),
      });
    }
  }

  return changes;
}

export function RevisionPanel({ revisions }: RevisionPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const filteredRevisions = useMemo(() => {
    if (filter === 'all') return revisions;
    return revisions.filter((rev) => {
      switch (filter) {
        case 'insertions': return isInsertion(rev);
        case 'deletions': return isDeletion(rev);
        case 'moves': return isMove(rev);
        case 'formatting': return isFormatChange(rev);
        default: return true;
      }
    });
  }, [revisions, filter]);

  const stats = useMemo(() => ({
    total: revisions.length,
    insertions: revisions.filter(isInsertion).length,
    deletions: revisions.filter(isDeletion).length,
    moves: revisions.filter(isMove).length,
    formatting: revisions.filter(isFormatChange).length,
  }), [revisions]);

  const toggleExpanded = (index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (revisions.length === 0) {
    return (
      <div className="rdv-revision-panel">
        <div className="rdv-revision-empty">
          <div className="rdv-revision-empty__icon">📝</div>
          <p>No tracked changes found in this document.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rdv-revision-panel">
      <div className="rdv-revision-header">
        <div className="rdv-revision-stats">
          <span className="rdv-revision-stat rdv-revision-stat--total">
            {stats.total} change{stats.total !== 1 ? 's' : ''}
          </span>
          {stats.insertions > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--insertion">
              +{stats.insertions}
            </span>
          )}
          {stats.deletions > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--deletion">
              −{stats.deletions}
            </span>
          )}
          {stats.moves > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--move">
              ↔{stats.moves}
            </span>
          )}
          {stats.formatting > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--format">
              ✎{stats.formatting}
            </span>
          )}
        </div>
        <select
          className="rdv-revision-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
        >
          <option value="all">All Changes</option>
          <option value="insertions">Insertions ({stats.insertions})</option>
          <option value="deletions">Deletions ({stats.deletions})</option>
          <option value="moves">Moves ({stats.moves})</option>
          <option value="formatting">Formatting ({stats.formatting})</option>
        </select>
      </div>

      <div className="rdv-revision-list">
        {filteredRevisions.map((revision, index) => {
          const isExpanded = expandedIds.has(index);
          const needsTruncation = revision.text.length > 150;
          const formatChanges = isFormatChange(revision) ? getFormatChanges(revision) : [];

          return (
            <div
              key={index}
              className={`rdv-revision-item ${getRevisionTypeClass(revision)}`}
            >
              <div className="rdv-revision-item__header">
                <span className="rdv-revision-type">
                  {getRevisionTypeLabel(revision)}
                </span>
                {isMove(revision) && revision.moveGroupId !== undefined && (
                  <span className="rdv-revision-move-id">#{revision.moveGroupId}</span>
                )}
                <span className="rdv-revision-author">{revision.author || 'Unknown'}</span>
                <span className="rdv-revision-date">{formatDate(revision.date)}</span>
              </div>

              {revision.text && (
                <div className="rdv-revision-item__content">
                  <span className="rdv-revision-text">
                    {isExpanded ? revision.text : truncateText(revision.text)}
                  </span>
                  {needsTruncation && (
                    <button
                      className="rdv-revision-expand"
                      onClick={() => toggleExpanded(index)}
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {formatChanges.length > 0 && (
                <div className="rdv-revision-item__format-details">
                  {formatChanges.map((change, i) => (
                    <div key={i} className="rdv-format-change">
                      <span className="rdv-format-change__property">{change.property}</span>
                      <span className="rdv-format-change__values">
                        {change.oldValue && (
                          <span className="rdv-format-change__old">{change.oldValue}</span>
                        )}
                        {change.oldValue && change.newValue && (
                          <span className="rdv-format-change__arrow">→</span>
                        )}
                        {change.newValue && (
                          <span className="rdv-format-change__new">{change.newValue}</span>
                        )}
                        {!change.oldValue && change.newValue && (
                          <span className="rdv-format-change__added">(added)</span>
                        )}
                        {change.oldValue && !change.newValue && (
                          <span className="rdv-format-change__removed">(removed)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
