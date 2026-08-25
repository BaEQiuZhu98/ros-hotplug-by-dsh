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
				const [note, setNote] = react.default.useState("");
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
					rpc("cap_list", {}).then((res) => {
						if (res && res.repo) setState(res);
						else setNote(res && res.error || "查询失败");
					}).catch((e) => setNote("失败: " + String(e && e.message ? e.message : e)));
				}
				react.default.useEffect(() => {
					refresh();
				}, []);
				function call(method, args) {
					rpc(method, args).then((res) => {
						if (res && res.ok) {
							if (res.physical && res.physical.ok === false) setNote("挂载成功, 但物理装配失败: " + String(res.physical.output || "").slice(0, 60));
							else setNote((res.output || "ok").slice(0, 80));
						} else setNote(res && res.error || "失败");
						refresh();
					}).catch((e) => setNote("失败: " + String(e && e.message ? e.message : e)));
				}
				function askAgent(arm) {
					const ia = props && props.inputActions;
					if (ia && typeof ia.setDraft === "function" && typeof ia.submit === "function") {
						ia.setDraft("用臂 " + arm + " 去拿小球");
						ia.submit();
						setNote("已把「用臂 " + arm + " 去拿小球」发给 agent, 由 agent 判断执行");
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
				const btnOn = {
					cursor: "pointer",
					fontSize: "12px",
					padding: "2px 8px",
					border: "1px solid #16a34a",
					borderRadius: "4px",
					background: "#dcfce7",
					color: "#14532d",
					fontWeight: "bold"
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
				const rowStyle = {
					display: "flex",
					alignItems: "center",
					gap: "6px",
					padding: "2px 0"
				};
				function b(label, fn, style) {
					return react.default.createElement("button", {
						onClick: fn,
						style: style || btn
					}, label);
				}
				function toolRow(arm) {
					const current = cur(arm);
					function toolBtn(cap, version) {
						const active = current !== null && current.cap === cap && current.version === version;
						return b(cap + version, function() {
							if (active) call("arm_unmount", { arm });
							else call("arm_mount", {
								arm,
								cap,
								version
							});
						}, active ? btnOn : btn);
					}
					return react.default.createElement("div", {
						key: arm,
						style: rowStyle
					}, react.default.createElement("span", { style: {
						fontWeight: "bold",
						width: "40px"
					} }, "臂 " + arm), ...(state.repo || []).filter(function(item) {
						return item.kind !== "sensor";
					}).map(function(item) {
						return toolBtn(item.cap, item.version);
					}), b("去拿小球", function() {
						askAgent(arm);
					}, btnGo));
				}
				function perceptionRow() {
					const slot = "perception";
					const current = curSlot(slot);
					const sensors = (state.repo || []).filter(function(item) {
						return item.kind === "sensor";
					});
					if (sensors.length === 0) return null;
					return react.default.createElement("div", { style: rowStyle }, react.default.createElement("span", { style: {
						fontWeight: "bold",
						width: "40px"
					} }, "感知"), ...sensors.map(function(item) {
						const active = current !== null && current.cap === item.cap && current.version === item.version;
						return b(item.cap + item.version, function() {
							if (active) call("slot_unmount", { slot });
							else call("slot_mount", {
								slot,
								cap: item.cap,
								version: item.version
							});
						}, active ? btnOn : btn);
					}));
				}
				const rowArms = Array.isArray(state.arms) && state.arms.length > 0 ? state.arms : ["A", "B"];
				return react.default.createElement("div", { style: {
					fontSize: "12px",
					padding: "4px 0"
				} }, react.default.createElement("div", { style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "4px"
				} }, react.default.createElement("span", { style: { fontWeight: "bold" } }, "能力面板(装/卸末端与感知, 拿小球交给 agent)"), note ? react.default.createElement("span", { style: { color: "#b45309" } }, note) : null, b("刷新", function() {
					refresh();
				}), b("全部复位", function() {
					call("reset_all", {});
				}, btnRst)), ...rowArms.map(function(arm) {
					return toolRow(arm);
				}), perceptionRow());
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
