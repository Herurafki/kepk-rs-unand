<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import FlowchartSelector from '../../../components/information/FlowchartSelector.vue'
import SubmissionFlowchart from '../../../components/information/SubmissionFlowchart.vue'
import { submissionFlowcharts, type FlowchartType } from '../../../data/submissionFlowcharts'

const activeType = ref<FlowchartType>('data-awal')

const activeFlowchart = computed(() =>
  submissionFlowcharts.find(option => option.key === activeType.value) ?? submissionFlowcharts[0],
)
</script>

<template>
  <div class="info-page">
    <PageHeader
      title="Alur Proses Pengajuan"
      description="Pilih jenis pengajuan untuk melihat tahapan prosesnya."
    />

    <FlowchartSelector v-model="activeType" :options="submissionFlowcharts" />
    <SubmissionFlowchart :image="activeFlowchart.image" :steps="activeFlowchart.steps" />
  </div>
</template>
