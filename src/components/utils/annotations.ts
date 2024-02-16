/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-case-declarations */
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { RefProxy } from 'pdfjs-dist/types/src/display/api'
import type { AnnotationEventPayload } from '../types'

interface PopupArgs {
  [key: string]: string
}

interface LinkAnnotation {
  dest: Array<any> | string
  url: string
  unsafeurl: string
}

const INTERNAL_LINK = 'internal-link'
const LINK = 'link'
const FILE_ATTACHMENT = 'file-attachment'
const FORM_TEXT = 'form-text'
const FORM_SELECT = 'form-select'
const FORM_CHECKBOX = 'form-checkbox'
const FORM_RADIO = 'form-radio'
const FORM_BUTTON = 'form-button'

const EVENTS_TO_HANDLER = ['click', 'dblclick', 'mouseover', 'input', 'change']

function getAnnotationsByKey(key: string, value: any, annotations: Object[]): any[] {
  const result = []
  if (annotations) {
    for (const annotation of annotations) {
      type Key = keyof typeof annotation
      if (annotation[key as Key] === value)
        result.push(annotation)
    }
  }
  return result
}

function buildAnnotationData(type: string, data: any): AnnotationEventPayload {
  return { type, data }
}

function inputAnnotation(evt: Event, inputEl: any, args?: any) {
  switch (inputEl.type) {
    case 'textarea':
    case 'text':
      return buildAnnotationData(FORM_TEXT, {
        fieldName: inputEl.name,
        value: inputEl.value,
      })
    case 'select-one':
    case 'select-multiple':
      const options = []
      for (const opt of inputEl.options) {
        options.push({
          value: opt.value,
          label: opt.label,
        })
      }
      const selected = []
      for (const opt of inputEl.selectedOptions) {
        selected.push({
          value: opt.value,
          label: opt.label,
        })
      }
      return buildAnnotationData(FORM_SELECT, {
        fieldName: inputEl.name,
        value: selected,
        options,
      })
    case 'checkbox':
      return buildAnnotationData(FORM_CHECKBOX, {
        fieldName: inputEl.name,
        checked: inputEl.checked,
      })
    case 'radio':
      return buildAnnotationData(FORM_RADIO, {
        fieldName: inputEl.name,
        ...args,
      })
    case 'button':
      return buildAnnotationData(FORM_BUTTON, {
        fieldName: inputEl.name,
        ...args,
      })
  }
}

function fileAnnotation(evt: Event, annotation: any) {
  return buildAnnotationData(FILE_ATTACHMENT, annotation.file)
}

async function linkAnnotation(evt: Event, annotation: {
  dest?: any
  url?: string
  unsafeUrl?: string
}, PDFDoc: PDFDocumentProxy) {
  if (annotation.dest) {
    // Get referenced page number of internal link
    if (typeof annotation.dest === 'string') {
      return buildAnnotationData(INTERNAL_LINK, {
        referencedPage: Number(annotation.dest.substring(1, annotation.dest.length)),
        offset: null,
      })
    }
    else {
      const pageIndex = await PDFDoc.getPageIndex(annotation.dest[0] as RefProxy)
      return buildAnnotationData(INTERNAL_LINK, {
        referencedPage: pageIndex + 1,
        offset: {
          left: annotation.dest[2],
          bottom: annotation.dest[3],
        },
      })
    }
  }
  else if (annotation.url) {
    return buildAnnotationData(LINK, {
      url: annotation.url,
      unsafeUrl: annotation.unsafeUrl,
    })
  }
}

function mergePopupArgs(annotation: HTMLElement) {
  for (const spanElement of annotation.getElementsByTagName('span')) {
    let content = spanElement.textContent
    const args = JSON.parse(spanElement.dataset.l10nArgs ?? '{}') as PopupArgs
    if (content) {
      for (const key in args)
        content = content.replace(`{{${key}}}`, args[key])
    }
    spanElement.textContent = content
  }
}

function mergePreferences(target: Object, source: Object) {
  const result = Object.assign({}, target)
  Object.keys(source).forEach((key: string) => {
    result[key] = Object.assign(result[key] ?? {}, source[key])
  })
  return result
}

function includesEvery(list: DOMTokenList, values: Array) {
  return values.every((element) => list.contains(element));
}

const defaultAnnotationPreferences: Object = {
  linkAnnotation: {
    events: ['click'],
    handler: linkAnnotation,
  },
  popupAnnotation: {
    events: [],
    handler: () => {},
  },
  textAnnotation: {
    events: [],
    handler: () => {},
  },
  freeTextAnnotation: {
    events: [],
    handler: () => {},
  },
  caretAnnotation: {
    events: [],
    handler: () => {},
  },
  highlightAnnotation: {
    events: [],
    handler: () => {},
  },
  fileAttachmentAnnotation: {
    events: ['dblclick'],
    handler: fileAnnotation,
  },
  textWidgetAnnotation: {
    events: ['input'],
    handler: inputAnnotation,
  },
  choiceWidgetAnnotation: {
    events: ['input'],
    handler: inputAnnotation,
  },
  checkBoxWidgetAnnotation: {
    events: ['change'],
    handler: inputAnnotation,
  },
  radioButtonWidgetAnnotation: {
    events: ['change'],
    handler: inputAnnotation,
  },
  pushButtonWidgetAnnotation: {
    events: ['click'],
    handler: inputAnnotation,
  },
}

// Use this function to handle annotation events
function annotationEventsHandler(evt: Event, PDFDoc: PDFDocumentProxy, Annotations: Object[], Preferences: Object) {
  let annotation = (evt.target as HTMLElement).closest('section') as HTMLElement

  // annotations are <section> elements if div returned find in child nodes the section element
  if (annotation.tagName === 'DIV')
    annotation = annotation.firstChild! as HTMLElement

  const preferences = mergePreferences(defaultAnnotationPreferences, Preferences)

  if (annotation.classList.contains('linkAnnotation') && preferences['linkAnnotation'].events.includes(evt.type)) {
    const id: string | undefined = annotation.dataset?.annotationId
    if (id)
      return preferences['linkAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0] as LinkAnnotation, PDFDoc)
  }
  else if (annotation.classList.contains('popupAnnotation') && preferences['popupAnnotation'].events.includes(evt.type)) {
    mergePopupArgs(annotation)
    const id = annotation.dataset.annotationId
    return preferences['popupAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0])
  }
  else if (annotation.classList.contains('textAnnotation') && preferences['textAnnotation'].events.includes(evt.type)) {
    mergePopupArgs(annotation)
    const id = annotation.dataset.annotationId
    return preferences['textAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0])
  }
  else if (annotation.classList.contains('freeTextAnnotation') && preferences['freeTextAnnotation'].events.includes(evt.type)) {
    mergePopupArgs(annotation)
    const id = annotation.dataset.annotationId
    return preferences['freeTextAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0])
  }
  else if (annotation.classList.contains('caretAnnotation') && preferences['caretAnnotation'].events.includes(evt.type)) {
    const id = annotation.dataset.annotationId
    mergePopupArgs(annotation)
    return preferences['caretAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0])
  }
  else if (annotation.classList.contains('highlightAnnotation') && preferences['highlightAnnotation'].events.includes(evt.type)) {
    const id = annotation.dataset.annotationId
    mergePopupArgs(annotation)
    return preferences['highlightAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0])
  }
  else if (annotation.classList.contains('fileAttachmentAnnotation')) {
    mergePopupArgs(annotation)
    const id = annotation.dataset.annotationId
    if (id && preferences['fileAttachmentAnnotation'].events.includes(evt.type))
      return preferences['fileAttachmentAnnotation'].handler(evt, getAnnotationsByKey('id', id, Annotations)[0])
  }
  else if (annotation.classList.contains('textWidgetAnnotation') && preferences['textWidgetAnnotation'].events.includes(evt.type)) {
    let inputElement: HTMLInputElement | HTMLTextAreaElement = annotation.getElementsByTagName('input')[0]
    if (!inputElement)
      inputElement = annotation.getElementsByTagName('textarea')[0]
    return preferences['textWidgetAnnotation'].handler(evt, inputElement)
  }
  else if (annotation.classList.contains('choiceWidgetAnnotation') && preferences['choiceWidgetAnnotation'].events.includes(evt.type)) {
    return preferences['choiceWidgetAnnotation'].handler(evt, annotation.getElementsByTagName('select')[0])
  }
  else if (includesEvery(annotation.classList, ['buttonWidgetAnnotation', 'checkBox']) && preferences['checkBoxWidgetAnnotation'].events.includes(evt.type)) {
    return preferences['checkBoxWidgetAnnotation'].handler(evt, annotation.getElementsByTagName('input')[0])
  }
  else if (includesEvery(annotation.classList, ['buttonWidgetAnnotation', 'radioButton']) && preferences['radioButtonWidgetAnnotation'].events.includes(evt.type)) {
    const id = annotation.dataset.annotationId
    if (id) {
      const anno = getAnnotationsByKey('id', id, Annotations)[0]
      const radioOptions = []
      for (const radioAnnotations of getAnnotationsByKey('fieldName', anno.fieldName, Annotations)) {
        if (radioAnnotations.buttonValue)
          radioOptions.push(radioAnnotations.buttonValue)
      }
      return preferences['radioButtonWidgetAnnotation'].handler(evt, annotation.getElementsByTagName('input')[0], {
        value: anno.buttonValue,
        defaultValue: anno.fieldValue,
        options: radioOptions,
      })
    }
  }
  else if (includesEvery(annotation.classList, ['buttonWidgetAnnotation', 'pushButton']) && preferences['pushButtonWidgetAnnotation'].events.includes(evt.type)) {
    const id = annotation.dataset.annotationId
    if (id) {
      const anno = getAnnotationsByKey('id', id, Annotations)[0]
      if (!anno.resetForm) {
        return preferences['pushButtonWidgetAnnotation'].handler(
          evt, 
          { name: anno.fieldName, type: 'button' },
          { actions: anno.actions, reset: false },
        )
      }
      else {
        return preferences['pushButtonWidgetAnnotation'].handler(
          evt, 
          { name: anno.fieldName, type: 'button' },
          { actions: anno.actions, reset: true },
        )
      }
    }
  }
}

export {
  EVENTS_TO_HANDLER,
  annotationEventsHandler,
}
