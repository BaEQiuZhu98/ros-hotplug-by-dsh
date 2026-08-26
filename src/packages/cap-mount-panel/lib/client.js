window.__ModuleLoader__.load({
	id: "@ros-hotplug/dsh-plugin-cap-mount-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/index.js
		const inject = ["slots"];
		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			slots.inject("conversation.input.dock", () => slots.register({
				name: "conversation.input.dock",
				id: "cap-mount-panel",
				order: 16,
				label: "能力面板"
			}, (props) => {
				const [state, setState] = react.default.useState({
					repo: [],
					mounted: [],
					slots: [],
					arms: []
				});
				const [caps, setCaps] = react.default.useState(null);
				const [note, setNote] = react.default.useState("");
				const [ballX, setBallX] = react.default.useState("");
				const [ballY, setBallY] = react.default.useState("");
				const [collapsed, setCollapsed] = react.default.useState(false);
				const [takeArm, setTakeArm] = react.default.useState("any");
				function rpc(method, args) {
					return fetch("/cap-mount/" + method, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(args || {})
					}).then(function(r) {
						return r.json();
					});
				}
				function cur(arm) {
					return (state.mounted || []).find((m) => m.arm === arm) || null;
				}
				function curSlot(slot) {
					return (state.slots || []).find((s) => s.slot === slot) || null;
				}
				function refresh() {
					rpc("query_state", {}).then((res) => {
						if (res && res.ok && res.list) {
							setState(res.list);
							setCaps(res.caps || null);
							if (res.caps && Array.isArray(res.caps.ball)) {
								setBallX(String(res.caps.ball[0]));
								setBallY(String(res.caps.ball[1]));
							}
							setNote(res.capsError || "");
						} else setNote(res && res.error || "查询失败");
					}).catch((e) => setNote("失败: " + String(e && e.message ? e.message : e)));
				}
				react.default.useEffect(() => {
					refresh();
				}, []);
				function call(method, args) {
					rpc(method, args).then((res) => {
						if (res && res.ok) {
							if (res.physical && res.physical.ok === false) setNote("挂载成功, 但物理装配失败: " + String(res.physical.output || "").slice(0, 60));
							else if (res.home && res.home.ok === false) setNote("已复位装配, 但回原位失败: " + String(res.home.output || "").slice(0, 60));
							else setNote((res.output || "ok").slice(0, 100));
						} else setNote(res && res.error || "失败");
						refresh();
					}).catch((e) => setNote("失败: " + String(e && e.message ? e.message : e)));
				}
				function askAgent() {
					const ia = props && props.inputActions;
					if (ia && typeof ia.setDraft === "function" && typeof ia.submit === "function") {
						const text = takeArm === "any" ? "去拿小球" : "用臂 " + takeArm + " 去拿小球";
						ia.setDraft(text);
						ia.submit();
						setNote("已把「" + text + "」发给 agent, 由 agent 判断执行");
					} else setNote("无法发送消息: 缺少 inputActions");
				}
				const btn = {
					cursor: "pointer",
					fontSize: "12px",
					padding: "2px 8px",
					border: "1px solid #d1d5db",
					borderRadius: "4px",
					background: "#fff",
					color: "#374151"
				};
				const btnGo = {
					cursor: "pointer",
					fontSize: "12px",
					padding: "2px 8px",
					border: "1px solid #2563eb",
					borderRadius: "4px",
					color: "#1d4ed8",
					background: "#eff6ff"
				};
				const btnRst = {
					cursor: "pointer",
					fontSize: "12px",
					padding: "2px 8px",
					border: "1px solid #ea580c",
					borderRadius: "4px",
					color: "#c2410c",
					background: "#fff7ed"
				};
				const selStyle = {
					fontSize: "12px",
					padding: "2px 4px",
					border: "1px solid #d1d5db",
					borderRadius: "4px",
					background: "#fff",
					color: "#374151",
					maxWidth: "150px"
				};
				const inpStyle = {
					fontSize: "12px",
					padding: "2px 4px",
					width: "48px",
					border: "1px solid #d1d5db",
					borderRadius: "4px"
				};
				const rowStyle = {
					display: "flex",
					alignItems: "center",
					gap: "6px",
					padding: "2px 0",
					flexWrap: "wrap"
				};
				function b(label, fn, style) {
					return react.default.createElement("button", {
						onClick: fn,
						style: style || btn
					}, label);
				}
				const rowArms = Array.isArray(state.arms) && state.arms.length > 0 ? state.arms : ["A", "B"];
				function mountOptions(kind, current) {
					const options = [{
						v: "none",
						label: "不装配"
					}];
					for (const item of state.repo || []) {
						if (!(kind === "sensor" ? item.kind === "sensor" : item.kind !== "sensor")) continue;
						options.push({
							v: item.cap + "@" + item.version,
							label: item.cap + " " + item.version
						});
					}
					if (current !== null && !options.some((o) => o.v === current.cap + "@" + current.version)) options.push({
						v: current.cap + "@" + current.version,
						label: "当前: " + current.cap + " " + current.version
					});
					return options;
				}
				function armRow(arm) {
					const current = cur(arm);
					const key = current === null ? "none" : current.cap + "@" + current.version;
					const options = mountOptions("tool", current);
					const physical = caps && caps.tools ? caps.tools[arm] : void 0;
					const select = react.default.createElement("select", {
						value: key,
						onChange: function(e) {
							const v = e.target.value;
							if (v === "none") call("arm_unmount", { arm });
							else {
								const parts = v.split("@");
								call("arm_mount", {
									arm,
									cap: parts[0],
									version: parts[1]
								});
							}
						},
						style: selStyle
					}, options.map((o) => react.default.createElement("option", {
						key: o.v,
						value: o.v
					}, o.label)));
					return react.default.createElement("div", {
						key: arm,
						style: rowStyle
					}, react.default.createElement("span", { style: {
						fontWeight: "bold",
						width: "40px"
					} }, "臂 " + arm), select, physical !== void 0 ? react.default.createElement("span", { style: { color: "#6b7280" } }, "物理: " + physical) : null);
				}
				function perceptionRow() {
					const slot = "perception";
					const current = curSlot(slot);
					if ((state.repo || []).filter(function(item) {
						return item.kind === "sensor";
					}).length === 0) return null;
					const key = current === null ? "none" : current.cap + "@" + current.version;
					const options = mountOptions("sensor", current);
					const select = react.default.createElement("select", {
						value: key,
						onChange: function(e) {
							const v = e.target.value;
							if (v === "none") call("slot_unmount", { slot });
							else {
								const parts = v.split("@");
								call("slot_mount", {
									slot,
									cap: parts[0],
									version: parts[1]
								});
							}
						},
						style: selStyle
					}, options.map((o) => react.default.createElement("option", {
						key: o.v,
						value: o.v
					}, o.label)));
					return react.default.createElement("div", { style: rowStyle }, react.default.createElement("span", { style: {
						fontWeight: "bold",
						width: "40px"
					} }, "感知"), select);
				}
				function takeRow() {
					const select = react.default.createElement("select", {
						value: takeArm,
						onChange: function(e) {
							setTakeArm(e.target.value);
						},
						style: selStyle
					}, react.default.createElement("option", { value: "any" }, "不指定臂"), ...rowArms.map(function(arm) {
						return react.default.createElement("option", {
							key: arm,
							value: arm
						}, "臂 " + arm);
					}));
					return react.default.createElement("div", { style: rowStyle }, react.default.createElement("span", { style: {
						fontWeight: "bold",
						width: "40px"
					} }, "拿小球"), select, b("去拿小球", function() {
						askAgent();
					}, btnGo));
				}
				function ballRow() {
					const ball = caps && Array.isArray(caps.ball) ? caps.ball : null;
					return react.default.createElement("div", { style: rowStyle }, react.default.createElement("span", { style: {
						fontWeight: "bold",
						width: "40px"
					} }, "小球"), react.default.createElement("span", { style: { color: "#6b7280" } }, "位置: " + (ball === null ? "未查询" : Number(ball[0]).toFixed(2) + ", " + Number(ball[1]).toFixed(2))), react.default.createElement("input", {
						value: ballX,
						placeholder: "x",
						onChange: function(e) {
							setBallX(e.target.value);
						},
						style: inpStyle
					}), react.default.createElement("input", {
						value: ballY,
						placeholder: "y",
						onChange: function(e) {
							setBallY(e.target.value);
						},
						style: inpStyle
					}), b("设定", function() {
						call("set_ball", {
							x: ballX,
							y: ballY
						});
					}));
				}
				const header = react.default.createElement("div", { style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					flexWrap: "wrap"
				} }, react.default.createElement("span", { style: { fontWeight: "bold" } }, "能力面板"), note ? react.default.createElement("span", { style: { color: "#b45309" } }, note) : null, b("刷新", function() {
					refresh();
				}), b("全部复位", function() {
					call("reset_all", {});
				}, btnRst), ...rowArms.map(function(arm) {
					return b("臂" + arm + "复位", function() {
						call("arm_reset", { arm });
					}, btnRst);
				}), b(collapsed ? "展开" : "折叠", function() {
					setCollapsed(!collapsed);
				}));
				return react.default.createElement("div", { style: {
					fontSize: "12px",
					padding: "4px 0"
				} }, header, collapsed ? null : react.default.createElement("div", null, ...rowArms.map(function(arm) {
					return armRow(arm);
				}), perceptionRow(), takeRow(), ballRow()));
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
