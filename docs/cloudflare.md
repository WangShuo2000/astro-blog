# Cloudflare 配置记录

配置及线上验证时间：**2026-10-24 00:26（Asia/Shanghai）**。

本文记录为解决 RSS 被 Cloudflare 拦截而在控制台手动添加的两条规则，供以后排查、重建和回滚。它不是整个 Cloudflare 账户的配置导出；提交本文、推送 GitHub 或重新构建博客都不会自动创建、修改或同步这些规则。

## 站点与控制台入口

| 项目 | 配置时的值 |
| --- | --- |
| 博客域名 | `trouvaille-blog.com` |
| RSS 地址 | <https://trouvaille-blog.com/rss.xml> |
| Pages 默认域名 | `astro-blog-dvy.pages.dev` |
| DNS | 根域名 CNAME 指向 `astro-blog-dvy.pages.dev`，状态为 **Proxied / 已代理** |
| Zone ID | `2059e122ec95b77144cf4cbcfed5a815` |

[查看两条 RSS 规则](https://dash.cloudflare.com/28612b3d92582842cea3aafeb37a2d94/trouvaille-blog.com/rules/overview?name=rss.xml+only)（需要登录对应 Cloudflare 账户）。控制台入口为：选择域名 → **规则 / Rules → 概述 / Overview**。

DNS 代理状态是当时核对的现有配置，本次没有修改。全局 Browser Integrity Check（浏览器完整性检查，简称 BIC）保持开启；本次只为 RSS 添加局部例外，没有添加跳过所有 WAF 的规则，也没有修改其他路径的防护、DNS 或 Pages 构建设置。

## 两条规则共用的匹配条件

选择 **自定义筛选表达式 / Custom filter expression**，填写：

```text
(http.host eq "trouvaille-blog.com" and http.request.uri.path eq "/rss.xml" and http.request.method in {"GET" "HEAD"})
```

- 只匹配 `trouvaille-blog.com` 的 `/rss.xml`，方法为 `GET` 或 `HEAD`。
- 查询参数不参与路径比较，因此 `/rss.xml?source=reader` 也会匹配。
- `/rss.xml/`、`/RSS.xml`、首页、文章页、其他主机名或其他请求方法不在此例外范围内。
- 不限制订阅器 IP 或 User-Agent，允许不同阅读器获取这份公开订阅源。

## 规则一：RSS 路径关闭 BIC

| 项目 | 值 |
| --- | --- |
| 名称 | `Allow RSS readers - rss.xml only` |
| 类型 | **Configuration Rules / 配置规则** |
| 状态 | 已启用 |
| 匹配条件 | 上述共用表达式 |
| 唯一设置 | 添加 **Browser Integrity Check**，开关设为 **Off / 关闭** |
| 顺序 | 配置时是该类型唯一规则，位于第 1 条 |
| Rule ID | `3c37eb520ed44bb9a14fbffa5a0c3ff9` |
| Ruleset phase | `http_config_settings` |

[打开这条配置规则](https://dash.cloudflare.com/28612b3d92582842cea3aafeb37a2d94/trouvaille-blog.com/rules/configuration-rules/3c37eb520ed44bb9a14fbffa5a0c3ff9)。

对应的关键参数如下，便于与 API 或 Trace 结果核对；不是完整的部署脚本：

```json
{
  "action": "set_config",
  "action_parameters": {
    "bic": false
  }
}
```

规则名里的 `Allow` 只是名称。这条规则只关闭匹配请求的 BIC，不是跳过所有安全检查的白名单。重建时必须添加 BIC 设置并显式设为 Off；不添加这项设置并不等于关闭它。

## 规则二：RSS 回源 User-Agent 兼容处理

| 项目 | 值 |
| --- | --- |
| 名称 | `RSS upstream compatibility - rss.xml only` |
| 类型 | **Request Header Transform Rules / 请求标头转换规则** |
| 状态 | 已启用 |
| 匹配条件 | 上述共用表达式 |
| 操作 | **Set static / 设置静态** |
| 标头名称 | `User-Agent` |
| 标头值 | `Trouvaille-RSS/1.0 (+https://trouvaille-blog.com/rss.xml)` |
| 顺序 | 配置时是该类型唯一规则，位于第 1 条 |
| Rule ID | `e310bc35adf94cbe94ad535141850104` |
| Ruleset phase | `http_request_late_transform` |

[打开这条请求头规则](https://dash.cloudflare.com/28612b3d92582842cea3aafeb37a2d94/trouvaille-blog.com/rules/transform-rules/modify-request-header/e310bc35adf94cbe94ad535141850104)。

对应的关键参数：

```json
{
  "action": "rewrite",
  "action_parameters": {
    "headers": {
      "user-agent": {
        "operation": "set",
        "value": "Trouvaille-RSS/1.0 (+https://trouvaille-blog.com/rss.xml)"
      }
    }
  }
}
```

这是**请求头**转换，不是响应头转换，也不需要修改 RSS XML 或向阅读器设置重定向。匹配请求在回源时使用统一的博客 RSS 标识，因此回源侧看到的 User-Agent 会相同；排查原始阅读器时需要结合边缘请求记录。

两种规则属于不同执行阶段，各自的“第 1 条”不是跨类型的排序。以后添加同类规则时，应检查是否有后面的规则再次启用 BIC，或覆盖这条 User-Agent 设置。

## 为什么需要两条规则

最初，Python 默认 User-Agent（实测为 `Python-urllib/3.13`）请求 RSS 返回 **403**，正文为 `error code: 1010`；普通 curl 和浏览器请求可以取得 RSS。安全事件中可以看到 BIC 拦截。

添加规则一后，Cloudflare Trace 已确认表达式命中且 `bic: false`，追踪以 200 结束；真实 RSS 流量记录显示“未缓解”，但外部 Python 请求仍返回 403。直接用相同 Python User-Agent 访问 Pages 默认域名也返回 403，而使用上述博客 RSS 标识可以取得正常 XML。

这些现象说明仍有后续链路的 User-Agent 兼容问题，但不足以确定 Pages 内部具体由哪个检查造成。添加规则二后，原始 Python 客户端请求自定义域名的 RSS 成功返回 200。最终保留这两条精确匹配的规则。

## 线上验证

只验证本地构建或使用浏览器打开 RSS，无法证明订阅器已经不受 Cloudflare 拦截。修改规则后，应直接请求线上域名，并保留原先失败的 Python User-Agent。

下面的命令不需要项目依赖；需要本机有 Python 3。它会检查 GET、HEAD、带查询参数请求、XML 解析和 ETag 条件请求：

```sh
python3 - <<'PY'
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

url = "https://trouvaille-blog.com/rss.xml"
headers = {"User-Agent": "Python-urllib/3.13"}

def fetch(target, method="GET", extra_headers=None):
    request = urllib.request.Request(
        target, method=method, headers={**headers, **(extra_headers or {})}
    )
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()

status, response_headers, body = fetch(url)
assert status == 200, (status, body[:200])
assert response_headers.get_content_type() == "application/xml"
feed = ET.fromstring(body)
assert feed.tag == "rss" and feed.find("channel") is not None
print("GET:", status, "文章数:", len(feed.findall("./channel/item")))

for method, target in [
    ("HEAD", url),
    ("GET", url + "?rss-check=" + str(int(time.time()))),
]:
    status, _, _ = fetch(target, method)
    assert status == 200, (method, target, status)
    print(method, target, status)

etag = response_headers.get("ETag")
assert etag, "缺少 ETag，需检查缓存协商行为"
status, _, _ = fetch(url, extra_headers={"If-None-Match": etag})
assert status == 304, ("If-None-Match", status)
print("If-None-Match:", status)
PY
```

若测试期间刚好发布了新内容，ETag 可能变化；条件请求返回 200 时，应重新获取当前 ETag 后复测。完整验收还应覆盖空 User-Agent、模拟 Feedly/FreshRSS 标识，以及首页、文章页和相近路径，确认匹配范围符合预期。

### 2026-10-24 验收快照

| 检查 | 结果 |
| --- | --- |
| Python 默认 UA：RSS GET、HEAD、带查询参数 GET | 全部 200 |
| 空 UA、模拟 Feedly、模拟 FreshRSS：RSS GET | 全部 200，XML 正常 |
| 携带当前 ETag 的条件 GET | 304 |
| XML 内容 | 19 篇文章，11,519 字节，与当时 `dist/rss.xml` 字节一致 |
| 首页及文章页：`Mozilla/5.0` 标识 | 200 |
| 首页、文章页、`/rss.xml/`、`/RSS.xml`：Python UA | 仍为 403，未被 RSS 例外放行 |

当时 RSS 的 SHA-256 为 `7bae3b0feeb91463e43c36f92861906ec6853d6b30c57312d5c7bbe3bd30f01d`。文章数、字节数、哈希和 ETag 会随内容发布而变化；上述 403 也只是当时其他路径保护行为的快照，不应作为永久断言。

## 排查与回滚

1. 在规则概述中搜索 `rss.xml only`，确认两条规则都已启用，表达式和设置与本文一致。Configuration Rules 需要域名的 DNS 记录处于 Proxied 状态。
2. 用 **规则模拟器 / Trace** 输入线上 RSS URL、`GET` 或 `HEAD` 以及失败客户端的 User-Agent，检查命中结果。Trace 是模拟结果，不能代替真实 HTTP 请求验证。
3. 到 **安全性 → 分析 → 事件**，按 `/rss.xml`、请求时间或 `CF-Ray` 查实际拦截服务；同时检查流量记录。若 BIC 已关闭但仍返回 403，继续核对后续链路和回源请求头，不要只凭 1010 重复添加相同例外。
4. 如果需要撤销，可在各规则菜单中**禁用**上述两条规则。可以先禁用请求头转换并复测，再禁用 BIC 局部例外；这个顺序便于观察各规则效果，不是产品强制依赖。禁用两条后会恢复本次变更前的配置，部分 RSS 客户端可能再次遇到 403。
5. 如需恢复，重新启用两条规则并执行线上验证。若规则被删除，按本文分别重建；新规则会获得不同 ID，需要同步更新本文链接。

回滚范围就是这两条规则，不需要操作全局 BIC 开关或 DNS。后续修改域名、RSS 路径或回源标识时，也要同步更新表达式、User-Agent 中的 URL、验证命令和本文记录。

## 官方参考

- [Browser Integrity Check](https://developers.cloudflare.com/waf/tools/browser-integrity-check/)
- [Configuration Rules 设置](https://developers.cloudflare.com/rules/configuration-rules/settings/)
- [Request Header Transform Rules](https://developers.cloudflare.com/rules/transform/request-header-modification/)
- [Cloudflare Trace](https://developers.cloudflare.com/rules/trace-request/)
