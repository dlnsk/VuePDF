# Table of content

```vue
<script setup>
  import { ref, triggerRef, watchEffect } from 'vue';
  import { VuePDF, usePDF } from '@tato30/vue-pdf';
  import { withBase } from '@vuepress/client';
  import ChaptersList from './ChaptersList.vue';

  const { pdf, info, getPDFDestination } = usePDF(withBase('/example_045.pdf'))
  const outlineTree = ref([])

  watchEffect(() => {
    if (info.value.outline !== undefined) {
      outlineTree.value = info.value.outline.map(function convert(node) {
        return {
          title: node.title,
          destination: getPDFDestination(info.value.document, node.dest),
          items: node.items.map((item) => {
            return convert(item)
          }),
        }
      })
    }
  })
  triggerRef(info)

  function onChapterClick(value) {
    value.then(v => {
      console.log(v)
    })
  }
</script>

<template>
  <div id="toc_wrapper">
    <div class="toc">
      <ChaptersList
          :items="outlineTree"
          @chapterClick="onChapterClick"
      >
      </ChaptersList>
    </div>
    <div class="container">
      <VuePDF :pdf="pdf" />
    </div>
  </div>
</template>
```
<ClientOnly>
  <TOC />
</ClientOnly>
