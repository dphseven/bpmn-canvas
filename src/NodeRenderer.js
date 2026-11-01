/**
 * Copyright 2026 Don Hussey
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * NodeRenderer
 * Generates HTML/SVG template representations and inner glyphs
 * for all standard and custom BPMN 2.0 element representations.
 */
export class NodeRenderer {
  /**
   * Renders inner icon for start, intermediate, boundary, and end events
   */
  static renderEventInnerIcon(type) {
    if (type === 'start-timer-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-start-timer-icon">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="10" cy="10" r="8" />
            <polyline points="10,5 10,10 13.5,10" />
          </svg>
        </div>
      `;
    }
    if (type === 'start-message-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-start-message-icon">
          <svg width="18" height="13" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
            <polyline points="2,2 10,8.5 18,2" />
          </svg>
        </div>
      `;
    }
    if (type === 'start-signal-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-start-signal-icon">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="10,2 18,17 2,17" />
          </svg>
        </div>
      `;
    }
    if (type === 'boundary-timer-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-boundary-timer-icon">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="10" cy="10" r="8" />
            <polyline points="10,5 10,10 13.5,10" />
          </svg>
        </div>
      `;
    }
    if (type === 'boundary-error-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-boundary-error-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      `;
    }
    if (type === 'boundary-message-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-boundary-message-icon">
          <svg width="14" height="10" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
            <polyline points="2,2 10,8.5 18,2" />
          </svg>
        </div>
      `;
    }
    if (type === 'boundary-signal-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-boundary-signal-icon">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="10,2 18,17 2,17" />
          </svg>
        </div>
      `;
    }
    if (type === 'intermediate-message-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-event-message-icon">
          <svg width="18" height="13" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
            <polyline points="2,2 10,8.5 18,2" />
          </svg>
        </div>
      `;
    }
    if (type === 'intermediate-signal-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-event-signal-icon">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="10,2 18,17 2,17" />
          </svg>
        </div>
      `;
    }
    if (type === 'intermediate-timer-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-event-timer-icon">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="10" cy="10" r="8" />
            <polyline points="10,5 10,10 13.5,10" />
          </svg>
        </div>
      `;
    }
    if (type === 'end-error-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-end-error-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      `;
    }
    if (type === 'end-terminate-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-end-terminate-icon">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="7" />
          </svg>
        </div>
      `;
    }
    if (type === 'end-message-event') {
      return `
        <div class="bpmn-event-inner-icon bpmn-end-message-icon">
          <svg width="18" height="13" viewBox="0 0 20 15" fill="currentColor">
            <rect x="1" y="1" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
            <polygon points="2,2 10,8.5 18,2" />
          </svg>
        </div>
      `;
    }
    return '';
  }

  /**
   * Generates HTML markup for any BPMN node
   */
  static renderNodeHtml(node, canvas = null) {
    const { type, label = '', data = {} } = node;

    if (type.includes('event')) {
      const innerIcon = NodeRenderer.renderEventInnerIcon(type);
      return `
        ${innerIcon}
        <div class="bpmn-event-floating-label">${label}</div>
      `;
    }

    if (type.includes('gateway')) {
      const isExclusive = type === 'gateway-exclusive';
      const icon = isExclusive ? '✕' : '+';
      return `
        <div class="bpmn-gateway-diamond">
          <span class="bpmn-gateway-icon">${icon}</span>
        </div>
        <div class="bpmn-gateway-floating-label">${label}</div>
      `;
    }

    if (type === 'text-annotation') {
      return `
        <div class="bpmn-annotation-bracket"></div>
        <div class="bpmn-annotation-text" spellcheck="false">${label}</div>
      `;
    }

    if (type === 'data-object') {
      return `
        <div class="bpmn-data-object-icon">
          <svg width="34" height="42" viewBox="0 0 16 20" fill="var(--bg-panel)" stroke="currentColor" stroke-width="1.5">
            <path d="M 2 2 L 10 2 L 14 6 L 14 18 L 2 18 Z" />
            <polyline points="10,2 10,6 14,6" fill="none" />
          </svg>
        </div>
        <div class="bpmn-data-object-floating-label">${label}</div>
      `;
    }

    // Activities / Tasks / Subprocesses
    let icon = '✋';
    let badge = 'Manual Task';

    const customDef = canvas?.registry?.get(type);
    if (customDef) {
      if (customDef.icon || customDef.iconSvg || customDef.symbolHtml) {
        icon = customDef.iconSvg || customDef.symbolHtml || customDef.icon;
      }
      if (customDef.badge || customDef.label) {
        badge = customDef.badge || customDef.label;
      }
    }

    if (type === 'user-task') {
      icon = '👤';
      badge = 'User Task';
    } else if (type === 'service-task') {
      icon = '⚙️';
      badge = 'Service Task';
    } else if (type === 'business-rule-task') {
      icon = '📊';
      badge = 'Rule Task';
    } else if (type === 'script-task') {
      icon = '📜';
      badge = 'Script Task';
    } else if (type === 'subprocess') {
      icon = '⊞';
      badge = 'Subprocess';
    }

    if (type === 'subprocess' && data && data.expanded) {
      return `
        <div class="bpmn-subprocess-header">
          <div class="bpmn-subprocess-title-wrap">
            <span class="bpmn-activity-icon" style="color: #818cf8;">${icon}</span>
            <span class="bpmn-activity-label" spellcheck="false" style="font-weight: 600; font-size: 13px; color: var(--text-main); margin: 0; text-align: left;">${label}</span>
          </div>
          <div class="bpmn-subprocess-marker-header" title="Collapse Subprocess">
            <span class="bpmn-subprocess-plus">−</span>
          </div>
        </div>
        <div class="bpmn-subprocess-subcanvas-area"></div>
        <div class="bpmn-subprocess-resize-handle" title="Drag to resize subcanvas"></div>
      `;
    } else {
      const subprocessMarker = (type === 'subprocess')
        ? `<div class="bpmn-subprocess-marker" title="Expand Subprocess"><span class="bpmn-subprocess-plus">+</span></div>`
        : '';

      return `
        <div class="bpmn-activity-header">
          <span class="bpmn-activity-icon">${icon}</span>
          <span style="font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">${badge}</span>
        </div>
        <div class="bpmn-activity-label" spellcheck="false">${label}</div>
        ${subprocessMarker}
      `;
    }
  }
}
