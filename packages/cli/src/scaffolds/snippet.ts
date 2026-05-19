export const SNIPPET_LIQUID = `{%- comment -%}
  {{name}} snippet. Use with: {% raw %}{% render '{{name}}' %}{% endraw %}
{%- endcomment -%}
<span class="alambic-snippet alambic-snippet--{{name}}">
  {{label}}
</span>
`;
