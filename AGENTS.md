<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture decisions
- Use Lovable Cloud as the source of truth for catalog, profiles, categories, showcases, and campaigns because admin edits must persist securely.
- Keep cart state in browser storage because checkout remains demonstrative in this phase.
- Use TanStack file routes and protected pathless layouts because the project is TanStack Start.
