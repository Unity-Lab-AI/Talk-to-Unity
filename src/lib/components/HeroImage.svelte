<script lang="ts">
  import { imageStore } from '../stores/imageStore';

  $: hasImage = !!$imageStore.currentImageUrl;
  $: isLoading = $imageStore.isLoading;
</script>

<figure
  id="hero-stage"
  class="image-stage"
  data-state={hasImage ? 'loaded' : 'empty'}
  class:loading={isLoading}
  aria-hidden={!hasImage}
>
  {#if $imageStore.currentImageUrl}
    <img
      id="hero-image"
      src={$imageStore.currentImageUrl}
      alt="AI generated visualization"
      loading="lazy"
      decoding="async"
      crossorigin="anonymous"
    />
  {/if}

  {#if isLoading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>Generating image...</p>
    </div>
  {/if}

  {#if $imageStore.error}
    <div class="error-message">
      {$imageStore.error}
    </div>
  {/if}
</figure>

<style>
  .image-stage {
    position: relative;
    width: 100%;
    max-width: 800px;
    aspect-ratio: 1;
    margin: 0 auto;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    overflow: hidden;
    transition: opacity 0.3s ease;
  }

  .image-stage[data-state="empty"] {
    opacity: 0.5;
  }

  .image-stage[data-state="loaded"] {
    opacity: 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: opacity 0.5s ease;
  }

  .loading-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    color: white;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: rgba(0, 255, 255, 1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 0, 0, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
  }
</style>
