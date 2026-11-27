<template>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <p>
        © {{ new Date().getFullYear() }} Komite Etik Penelitian Kesehatan Rumah Sakit Universitas Andalas
      </p>
      <p>
        Dukungan: <a href="mailto:mail@rsp.unand.ac.id">mail@rsp.unand.ac.id</a>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--sidebar-border);
  background: var(--color-primary);
}

.site-footer__inner {
  width: min(1160px, 100%);
  margin: 0 auto;
  padding: 20px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--color-text-inverse);
  font-size: 0.9rem;
}

.site-footer__inner a {
  color: var(--color-text-inverse);
}
</style>
