<template>
    <div class="page">
        <header><span class="eyebrow">SEKRETARIAT KEPK</span>
            <h1>Notifikasi</h1>
            <p>Informasi aktivitas yang membutuhkan perhatian Sekretariat KEPK.</p>
        </header>
        <section class="card">
            <div class="empty">Belum ada notifikasi yang perlu ditampilkan.</div>
        </section>
    </div>
</template>
<style
    scoped>
    .page {
        display: flex;
        flex-direction: column;
        gap: 24px
    }

    .eyebrow {
        color: var(--primary);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .08em
    }

    h1 {
        margin: 8px 0;
        color: var(--foreground);
        font-size: 32px
    }

    p {
        margin: 0;
        color: var(--muted-foreground);
        font-size: 14px
    }

    .card {
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--card);
        box-shadow: var(--shadow-sm)
    }

    .empty {
        min-height: 260px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--muted-foreground);
        padding: 24px;
        text-align: center
    }
</style>
