<script setup lang="ts">
import HeroSection from '../../components/landing/HeroSection.vue'
import AboutUsSection from '../../components/landing/AboutUsSection.vue'
import ServicesSection from '../../components/landing/ServicesSection.vue'
import InformationSection from '../../components/landing/InformationSection.vue'
import FaqSection from '../../components/landing/FaqSection.vue'
</script>

<template>
  <div class="landing-page">
    <HeroSection />
    <AboutUsSection />
    <ServicesSection />
    <InformationSection />
    <FaqSection />

  </div>
</template>

<style scoped>
.landing-page {
  display: grid;
  gap: 26px;
}

.landing-cta {
  padding: 30px 26px;
  text-align: left;
  display: grid;
  gap: 12px;
}
</style>
