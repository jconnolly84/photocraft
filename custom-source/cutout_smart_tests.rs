    #[test]
    fn remove_background_preserves_smart_object_and_undo() {
        let (mut s, inside) = disc(8);
        s.execute("layer.smartObjects.convertToSmartObject", json!({})).unwrap();
        let id = active_id(&s);
        assert!(matches!(layer(&s, id).content, LayerContent::Smart(_)));
        assert!(s.is_enabled(CMD));
        let steps = s.active().unwrap().history.past_len();
        s.execute(CMD, json!({})).unwrap();
        assert_eq!(s.active().unwrap().history.past_len(), steps + 1);
        assert!(matches!(layer(&s, id).content, LayerContent::Smart(_)));
        assert!(layer(&s, id).mask.is_some());
        assert!(mask_iou(&s, 200, 160, inside) >= 0.75);
        s.execute("edit.undo", json!({})).unwrap();
        assert!(matches!(layer(&s, id).content, LayerContent::Smart(_)));
        assert!(layer(&s, id).mask.is_none());
        s.execute("layer.setProps", json!({"locks": {"all": true}})).unwrap();
        assert!(!s.is_enabled(CMD), "respect locked Smart Objects");
    }

