<template>
    <Button
        variant="ghost"
        size="icon"
        class="relative"
        :title="
            colorMode.value === 'light'
                ? t('shell.theme.toDark')
                : t('shell.theme.toLight')
        "
        @click="toggleColorMode"
    >
        <Sun
            class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Moon
            class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        />
        <span class="sr-only">{{ t("shell.theme.toggle") }}</span>
    </Button>
</template>

<script setup lang="ts">
import { Sun, Moon } from "lucide-vue-next";

const colorMode = useColorMode();
const { t } = useI18n();

const toggleColorMode = () => {
    colorMode.preference = colorMode.value === "light" ? "dark" : "light";
};
</script>
