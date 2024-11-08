import { Component } from "solid-js";

const AiFillGithub: Component<{ class?: string }> = (props) => {
  return (
    <div class={props.class}>
      <svg
        class="size-full"
        fill="currentColor"
        stroke-width="0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        height="1em"
        width="1em"
        style="overflow: visible; color: currentcolor;"
      >
        <path
          fill="currentColor"
          d="M8 .198a8 8 0 0 0-2.529 15.591c.4.074.547-.174.547-.385 0-.191-.008-.821-.011-1.489-2.226.484-2.695-.944-2.695-.944-.364-.925-.888-1.171-.888-1.171-.726-.497.055-.486.055-.486.803.056 1.226.824 1.226.824.714 1.223 1.872.869 2.328.665.072-.517.279-.87.508-1.07-1.777-.202-3.645-.888-3.645-3.954 0-.873.313-1.587.824-2.147-.083-.202-.357-1.015.077-2.117 0 0 .672-.215 2.201.82A7.672 7.672 0 0 1 8 4.066c.68.003 1.365.092 2.004.269 1.527-1.035 2.198-.82 2.198-.82.435 1.102.162 1.916.079 2.117.513.56.823 1.274.823 2.147 0 3.073-1.872 3.749-3.653 3.947.287.248.543.735.543 1.481 0 1.07-.009 1.932-.009 2.195 0 .213.144.462.55.384A8 8 0 0 0 8.001.196z"
        ></path>
      </svg>
    </div>
  );
};

const Bluesky: Component<{ class?: string }> = (props) => {
  return (
    <div class={props.class}>
      <svg
        class="size-full"
        width="1em"
        height="1em"
        viewBox="0 0 568 501"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C353.473 576.312 301.061 422.461 287.631 383.039C285.169 375.812 284.017 372.431 284 375.306C283.983 372.431 282.831 375.812 280.369 383.039C266.939 422.461 214.527 576.312 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0535 296.954 15.7778 224.501C9.94525 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1345 -1.61183 123.121 33.6637Z" />
      </svg>
    </div>
  );
};

const TbMoonStar: Component<{ class?: string }> = (props) => {
  return (
    <div class={props.class}>
      <svg
        class="size-full"
        fill="none"
        stroke-width="2"
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="overflow: visible; color: currentcolor;"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"></path>
        <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"></path>
        <path d="M19 11h2m-1 -1v2"></path>
      </svg>
    </div>
  );
};

const TbSun: Component<{ class?: string }> = (props) => {
  return (
    <div class={props.class}>
      <svg
        class="size-full"
        fill="none"
        stroke-width="2"
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="overflow: visible; color: currentcolor;"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path>
        <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"></path>
      </svg>
    </div>
  );
};

export { AiFillGithub, Bluesky, TbMoonStar, TbSun };
