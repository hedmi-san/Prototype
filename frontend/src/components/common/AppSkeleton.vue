<script setup lang="ts">
interface Props {
  width?: string;
  height?: string;
  borderRadius?: string;
  count?: number;
}

withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '20px',
  borderRadius: 'var(--radius-sm)',
  count: 1,
});
</script>

<template>
  <div class="skeleton-wrapper">
    <div
      v-for="i in count"
      :key="i"
      class="skeleton"
      :style="{
        width: width,
        height: height,
        borderRadius: borderRadius,
        marginBottom: count > 1 ? '8px' : '0',
      }"
    />
  </div>
</template>

<style scoped>
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
