export function Header(props) {
  return <div class="mb-2 flex w-[20rem] items-center">
    <div class="basis-1/3">
      <div
        class="w-fit cursor-pointer"
        title="Theme"
        onClick={() => {
          props.setTheme(props.theme === "light" ? "dark" : "light");
          if (props.theme === "dark")
            document.documentElement.classList.add("dark");
          else document.documentElement.classList.remove("dark");
          localStorage.theme = props.theme;
        }}
      >
        {props.theme === "dark" ?
          <div class="i-tabler-moon-stars text-xl" />
          : <div class="i-tabler-sun text-xl" />}
      </div>
    </div>
    <div class="basis-1/3 text-center text-xl font-bold">
      <a href="" class="hover:underline">
        cleanfollow
      </a>
    </div>
    <div class="justify-right flex basis-1/3 gap-x-2">
      <a
        title="GitHub"
        href="https://github.com/notjuliet/cleanfollow-bsky"
        target="_blank"
      >
        <button class="i-bi-github text-xl" />
      </a>
      <a title="Donate" href="https://ko-fi.com/notjuliet" target="_blank"><button class="i-simple-icons-kofi text-xl"></button></a>
    </div>
  </div>;
}