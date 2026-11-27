<script setup lang="ts">
import { ref } from 'vue'
import FaqItem from './FaqItem.vue'
import { faqItems } from '../../data/faq'

// Single-open accordion: opening one item closes the previously open one.
const openIndex = ref<number | null>(null)

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<template>
  <section class="landing-section">
    <p class="landing-section__eyebrow">FAQ</p>
    <h2>Pertanyaan yang Sering Diajukan</h2>

    <div class="faq-list">
      <FaqItem
        v-for="(item, index) in faqItems"
        :key="item.question"
        :question="item.question"
        :answer="item.answer"
        :is-open="openIndex === index"
        @toggle="toggle(index)"
      />
    </div>
  </section>
</template>

<style scoped>
.faq-list {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}
</style>
